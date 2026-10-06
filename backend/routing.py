"""
Real recovery-route optimisation using Google OR-Tools.

Solves a single-vehicle closed-tour TSP (boat starts at a fixed point,
visits every confirmed item exactly once, returns to the start) over a
Euclidean distance matrix. This is a genuine OR-Tools routing solve — not
a hardcoded order — scoped to one boat/day, which is what the JalNiriksh
pitch describes ("plans recovery routes"). Multi-vehicle / capacity
constraints are a natural next step (see README) but out of scope for
this pass.
"""
import math
from typing import List, Dict, Any

from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp


def _distance_matrix(points):
    n = len(points)
    mat = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            dx = points[i][0] - points[j][0]
            dy = points[i][1] - points[j][1]
            mat[i][j] = int(round(math.hypot(dx, dy) * 1000))
    return mat


def plan_route(boat_start: Dict[str, float], items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    items: list of {"id": ..., "x": float, "y": float, ...} in a shared
    local coordinate space (km or normalized survey-area units).
    Returns the visiting order (list of item ids) and total route distance.
    """
    if not items:
        return {"order": [], "total_distance": 0.0, "legs": []}

    points = [(boat_start["x"], boat_start["y"])] + [(it["x"], it["y"]) for it in items]
    dist_matrix = _distance_matrix(points)

    manager = pywrapcp.RoutingIndexManager(len(points), 1, 0)
    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return dist_matrix[from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_parameters.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_parameters.time_limit.FromSeconds(2)

    solution = routing.SolveWithParameters(search_parameters)
    if solution is None:
        raise RuntimeError("OR-Tools failed to find a route solution")

    order_ids = []
    legs = []
    index = routing.Start(0)
    prev_node = manager.IndexToNode(index)
    total_distance = 0
    while not routing.IsEnd(index):
        node = manager.IndexToNode(index)
        if node != 0:
            order_ids.append(items[node - 1]["id"])
        next_index = solution.Value(routing.NextVar(index))
        next_node = manager.IndexToNode(next_index)
        leg_dist = dist_matrix[node][next_node] / 1000.0
        if node != next_node:
            legs.append({"from": "boat" if node == 0 else items[node - 1]["id"],
                         "to": "boat" if next_node == 0 else items[next_node - 1]["id"],
                         "distance_km": round(leg_dist, 3)})
        total_distance += leg_dist
        index = next_index

    return {
        "order": order_ids,
        "total_distance_km": round(total_distance, 3),
        "legs": legs,
        "solver": "OR-Tools Routing (PATH_CHEAPEST_ARC + Guided Local Search, 2s limit)",
    }
