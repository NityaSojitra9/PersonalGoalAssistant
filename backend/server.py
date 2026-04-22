"""
server.py
Main entry point for the Personal Goal Assistant Flask Backend.
Provides RESTful endpoints for mission planning, execution tracking, and analytics.
"""

import os
import sys
from datetime import datetime
from typing import Tuple, Dict, Any, List

from flask import Flask, request, jsonify, Response
from flask_cors import CORS

# Project Path Calibration
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.append(project_root)

# Internal Imports
from agent.subtask_generation import generate_subtasks
from agent.task_execution import perform_subtask
from backend.models import db, Mission, Subtask, Habit, HabitLog

def create_app() -> Flask:
    """
    Application factory for the Flask server.
    """
    app = Flask(__name__)
    CORS(app)

    # Configuration
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///goals.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    db.init_app(app)

    with app.app_context():
        db.create_all()

    return app

app = create_app()

@app.route('/run', methods=['POST'])
def run_agent() -> Tuple[Response, int]:
    """
    Initiates the RL agent to plan and execute a goal.
    Returns:
        JSON response with mission details and agent logs.
    """
    try:
        if request.is_json:
            data = request.get_json()
            goal = data.get('goal')
            intensity = data.get('intensity', 'balanced')
        else:
            goal = request.form.get('goal')
            intensity = request.form.get('intensity', 'balanced')

        if not goal:
            return jsonify({'error': 'No goal provided'}), 400

        print(f"[*] Dispatching mission: {goal} [Intensity: {intensity}]")

        # Persistence Sequence
        new_mission = Mission(goal=goal, intensity=intensity)
        db.session.add(new_mission)
        db.session.commit()

        # Strategic planning via agent
        subtasks_text = generate_subtasks(goal, intensity=intensity)

        # Execution Sequence
        agent_output = []
        for index, task_text in enumerate(subtasks_text, start=1):
            st = Subtask(mission_id=new_mission.id, text=task_text, order=index)
            db.session.add(st)
            
            # Simulated RL Execution
            status = perform_subtask(task_text)
            agent_output.append({
                'step': index,
                'action': task_text,
                'status': status
            })
        
        db.session.commit()

        return jsonify({
            'mission_id': new_mission.id,
            'result': f'Strategic objectives for "{goal}" crystallized.',
            'agent_output': agent_output,
            'subtasks': new_mission.to_dict()['subtasks']
        }), 200

    except Exception as e:
        print(f"[!] Critical core error: {str(e)}")
        return jsonify({'error': 'Neural Link Failure', 'details': str(e)}), 500

@app.route('/missions', methods=['GET'])
def get_missions() -> Response:
    """
    Retrieves historical mission telemetry.
    """
    missions = Mission.query.order_by(Mission.timestamp.desc()).all()
    return jsonify([m.to_dict() for m in missions])

@app.route('/subtasks/<int:subtask_id>', methods=['PATCH'])
def update_subtask(subtask_id: int) -> Response:
    """
    Updates the completion state of a specific subtask.
    """
    data = request.get_json()
    subtask = Subtask.query.get_or_404(subtask_id)
    
    if 'is_completed' in data:
        subtask.is_completed = data['is_completed']
    
    db.session.commit()
    return jsonify({'success': True, 'subtask': subtask.to_dict()})

@app.route('/analytics/stats', methods=['GET'])
def get_analytics_stats() -> Response:
    """
    Aggregates performance metrics across all missions.
    """
    total = Mission.query.count()
    completed = Mission.query.filter_by(is_completed=True).count()
    
    success_rate = (completed / total * 100) if total > 0 else 0
    
    return jsonify({
        'totalMissions': total,
        'completedMissions': completed,
        'successRate': round(success_rate, 1),
        'distribution': {
            'blitz': Mission.query.filter_by(intensity='blitz').count(),
            'balanced': Mission.query.filter_by(intensity='balanced').count(),
            'mastery': Mission.query.filter_by(intensity='mastery').count()
        }
    })

@app.route('/analytics/topology', methods=['GET'])
def get_topology() -> Response:
    """
    Generates a graph-based representation of mission networks.
    """
    missions = Mission.query.order_by(Mission.timestamp.desc()).limit(10).all()
    nodes = []
    links = []
    
    for m in missions:
        m_id = f"m_{m.id}"
        nodes.append({
            'id': m_id,
            'label': m.goal,
            'type': 'mission',
            'intensity': m.intensity,
            'completed': m.is_completed
        })
        
        for st in m.subtasks:
            st_id = f"st_{st.id}"
            nodes.append({'id': st_id, 'label': st.text, 'type': 'subtask', 'completed': st.is_completed})
            links.append({'source': m_id, 'target': st_id})
            
    return jsonify({'nodes': nodes, 'links': links})

@app.route('/health', methods=['GET'])
def health_check() -> Response:
    """
    System health diagnostics.
    """
    return jsonify({'status': 'healthy', 'message': 'API v2.1.0 Operational'})

# --- Quantum Forge (Optional/Extensible Modules) ---

@app.route('/forge/habits', methods=['GET', 'POST'])
def handle_habits() -> Response:
    if request.method == 'POST':
        data = request.json
        new_habit = Habit(name=data.get('name'), cue=data.get('cue'), frequency=data.get('frequency', 'daily'))
        db.session.add(new_habit)
        db.session.commit()
        return jsonify({'success': True, 'habit': new_habit.to_dict()})
    
    return jsonify([h.to_dict() for h in Habit.query.all()])

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"[*] Life Engine online (Vite Proxy: http://localhost:{port})")
    app.run(host='0.0.0.0', port=port, debug=True)
