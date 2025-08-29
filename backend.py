from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

teams = [
    {"name": "Team 1", "points": 0},
    {"name": "Team 2", "points": 0},
    {"name": "Team 3", "points": 0},
    {"name": "Team 4", "points": 0},
    {"name": "Team 5", "points": 0},
]

def get_points(team_index):
    if 0 <= team_index < len(teams):
        return teams[team_index]["points"]
    return None

def set_points(team_index, pts):
    if 0 <= team_index < len(teams):
        teams[team_index]["points"] = pts
        log_points()

def add_points(team_index, pts):
    if 0 <= team_index < len(teams):
        teams[team_index]["points"] += pts
        log_points()

def log_points():
    print("Current team points:")
    for team in teams:
        print(f"{team['name']}: {team['points']}")

@app.route('/api/add_points', methods=['POST'])
def api_add_points():
    data = request.get_json()
    team_index = int(data.get('team_index', -1))
    points = int(data.get('points', 0))
    add_points(team_index, points)
    return jsonify({"success": True})

# Example usage:
if __name__ == "__main__":
    app.run(debug=True)
