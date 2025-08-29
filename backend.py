# Required libraries:
# pip install flask flask-cors

from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

teams = [
    {"name": "Kny", "points": 0},
    {"name": "B", "points": 0},
    {"name": "C", "points": 0},
    {"name": "D", "points": 0},
    {"name": "E", "points": 0},
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
        print(f"Added {pts} point(s) to {teams[team_index]['name']}.")
        log_points()

def log_points():
    print("Current team points:")
    for team in teams:
        print(f"{team['name']}: {team['points']}")
    print("-" * 30)

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
