"""
Real recovery-route optimisation using Google OR-Tools.

Solves a single-vehicle TSP over a Euclidean distance matrix: visit every
confirmed item exactly once, starting at a fixed point and optionally
ending at a different one (e.g. boat jetty -> items -> waste-handling
quay). This is a genuine OR-Tools routing solve, not a hardcoded order or
sort. Multi-vehicle / capacity constraints are a natural next step but
out of scope for this pass.
"""
import math
from typing import List, Dict, Any, Optional

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


def plan_route(
    boat_start: Dict[str, float],
    items: List[Dict[str, Any]],
    boat_end: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """
    items: list of {"id": ..., "x": float, "y": float, ...} in a shared
    local coordinate space (km or normalised survey-area units — whatever
    unit the caller used, total_distance_km is reported in that same unit).

    boat_end: if omitted, solves a closed tour (return to boat_start).
    If given, solves an open path ending at boat_end instead (e.g. a
    separate waste-handling quay).
    """
    if not items:
        return {"order": [], "total_distance_km": 0.0, "legs": [], "solver": None}

    points = [(boat_start["x"], boat_start["y"])] + [(it["x"], it["y"]) for it in items]
    end_node = 0
    if boat_end is not None:
        points.append((boat_end["x"], boat_end["y"]))
        end_node = len(points) - 1

    dist_matrix = _distance_matrix(points)

    if boat_end is not None:
        manager = pywrapcp.RoutingIndexManager(len(points), 1, [0], [end_node])
    else:
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

    def node_label(node):
        if node == 0:
            return "start"
        if node == end_node:
            return "end"
        return items[node - 1]["id"]

    order_ids = []
    legs = []
    index = routing.Start(0)
    total_distance = 0
    while not routing.IsEnd(index):
        node = manager.IndexToNode(index)
        if node != 0 and node != end_node:
            order_ids.append(items[node - 1]["id"])
        next_index = solution.Value(routing.NextVar(index))
        next_node = manager.IndexToNode(next_index)
        leg_dist = dist_matrix[node][next_node] / 1000.0
        if node != next_node:
            legs.append({"from": node_label(node), "to": node_label(next_node), "distance_km": round(leg_dist, 3)})
        total_distance += leg_dist
        index = next_index

    return {
        "order": order_ids,
        "total_distance_km": round(total_distance, 3),
        "legs": legs,
        "solver": "OR-Tools Routing (PATH_CHEAPEST_ARC + Guided Local Search, 2s limit)",
    }
