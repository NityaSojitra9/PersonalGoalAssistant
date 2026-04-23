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
from backend.models import db, Mission, Subtask, Habit, HabitLog, UserStats

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
            persona = data.get('persona', 'strategist')
        else:
            goal = request.form.get('goal')
            intensity = request.form.get('intensity', 'balanced')
            persona = request.form.get('persona', 'strategist')

        if not goal:
            return jsonify({'error': 'No goal provided'}), 400

        print(f"[*] Dispatching mission: {goal} [Intensity: {intensity}, Persona: {persona}]")

        # Persistence Sequence
        new_mission = Mission(goal=goal, intensity=intensity)
        db.session.add(new_mission)
        db.session.commit()

        # Strategic planning via agent
        subtasks_text = generate_subtasks(goal, intensity=intensity, persona=persona)

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

def award_xp(amount: int):
    """Awards XP to the user, creating the stats record if it doesn't exist."""
    stats = UserStats.query.first()
    if not stats:
        stats = UserStats(xp=0)
        db.session.add(stats)
    stats.xp += amount
    db.session.commit()

@app.route('/user/stats', methods=['GET'])
def get_user_stats() -> Response:
    """Retrieves current mastery stats."""
    stats = UserStats.query.first()
    if not stats:
        stats = UserStats(xp=0)
        db.session.add(stats)
        db.session.commit()
    return jsonify(stats.to_dict())

@app.route('/subtasks/<int:subtask_id>', methods=['PATCH'])
def update_subtask(subtask_id: int) -> Response:
    """
    Updates the completion state of a specific subtask and awards XP.
    """
    data = request.get_json()
    subtask = Subtask.query.get_or_404(subtask_id)
    
    if 'is_completed' in data:
        was_completed = subtask.is_completed
        subtask.is_completed = data['is_completed']
        
        # Award XP if transitioning from Incomplete to Complete
        if not was_completed and subtask.is_completed:
            award_xp(50)
    
    db.session.commit()
    return jsonify({
        'success': True, 
        'subtask': subtask.to_dict(),
        'userStats': UserStats.query.first().to_dict()
    })

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

@app.route('/forge/log', methods=['POST'])
def log_habit() -> Response:
    """Records a habit completion and awards XP."""
    data = request.json
    habit_id = data.get('habit_id')
    status = data.get('status', 'completed')
    
    habit = Habit.query.get_or_404(habit_id)
    new_log = HabitLog(habit_id=habit.id, status=status)
    db.session.add(new_log)
    
    if status == 'completed':
        award_xp(25)
        
    db.session.commit()
    return jsonify({'success': True, 'log': new_log.to_dict(), 'userStats': UserStats.query.first().to_dict()})

@app.route('/forge/predict', methods=['GET'])
def predict_habits() -> Response:
    """Generates simulated projections for habits."""
    habits = Habit.query.all()
    projections = []
    
    for h in habits:
        logs_count = len(h.logs)
        consistency = min(100, logs_count * 10) # Simple logic for demo
        
        projections.append({
            'habit': h.name,
            'persona': 'Strategist' if consistency > 50 else 'Novice',
            'consistency': consistency,
            'prediction30Days': f"Expected to reach {consistency + 5}% mastery based on current velocity.",
            'prediction365Days': f"Full behavioral integration predicted by Q3 next year."
        })
        
    return jsonify({'projections': projections})

@app.route('/analytics/aura', methods=['GET'])
def get_aura_analytics() -> Response:
    """Calculates the user's personality aura based on mission data."""
    missions = Mission.query.all()
    if not missions:
        return jsonify({
            'type': 'Neutral',
            'color': 'rgba(255, 255, 255, 0.5)',
            'description': 'Awaiting mission data to crystallize your aura.',
            'stats': {'blitz': 0, 'balanced': 0, 'mastery': 0}
        })
    
    blitz = Mission.query.filter_by(intensity='blitz').count()
    balanced = Mission.query.filter_by(intensity='balanced').count()
    mastery = Mission.query.filter_by(intensity='mastery').count()
    
    total = len(missions)
    
    # Logic to determine aura type
    if blitz > balanced and blitz > mastery:
        aura_type = "Sonic Catalyst"
        color = "hsla(190, 100%, 50%, 0.6)" # Cyan
        desc = "Your energy is fast and decisive. You thrive in high-velocity execution."
    elif mastery > balanced and mastery > blitz:
        aura_type = "Eternal Architect"
        color = "hsla(280, 100%, 70%, 0.6)" # Purple
        desc = "You seek depth and perfection. Your growth is structured and immutable."
    else:
        aura_type = "Harmonic Warden"
        color = "hsla(140, 60%, 50%, 0.6)" # Green
        desc = "You maintain a perfect equilibrium between speed and quality."
        
    return jsonify({
        'type': aura_type,
        'color': color,
        'description': desc,
        'stats': {
            'blitz': round(blitz/total * 100),
            'balanced': round(balanced/total * 100),
            'mastery': round(mastery/total * 100)
        }
    })

@app.route('/analytics/knowledge', methods=['GET'])
def get_knowledge_graph() -> Response:
    """Returns the expert knowledge base formatted for 3D graph visualization."""
    from agent.knowledge_base import EXPERTS
    
    nodes = []
    links = []
    
    # Root Node
    nodes.append({"id": "EKB", "label": "Expert Knowledge", "type": "root", "color": "#00d2ff"})
    
    for category, subcats in EXPERTS.items():
        cat_id = f"cat_{category}"
        nodes.append({"id": cat_id, "label": category.upper(), "type": "category", "color": "#bf9eff"})
        links.append({"source": "EKB", "target": cat_id})
        
        for subcat, steps in subcats.items():
            sub_id = f"sub_{category}_{subcat}"
            nodes.append({"id": sub_id, "label": subcat.title(), "type": "subcategory", "color": "#00d2ff"})
            links.append({"source": cat_id, "target": sub_id})
            
            # Limit steps to avoid clutter, just show first 3 as sub-nodes
            for i, step in enumerate(steps[:3]):
                step_id = f"step_{category}_{subcat}_{i}"
                nodes.append({"id": step_id, "label": f"Step {i+1}", "type": "step", "color": "#ffffff", "full_text": step})
                links.append({"source": sub_id, "target": step_id})
                
    return jsonify({"nodes": nodes, "links": links})

@app.route('/chronos/schedule', methods=['GET'])
def get_chronos_schedule() -> Response:
    """Simulates a temporal optimization schedule."""
    # Simulated data based on common mission structures
    schedule = [
        {"time": "08:00", "task": "Neural Priming", "intensity": 0.3, "status": "completed"},
        {"time": "09:30", "task": "Deep Mission Execution", "intensity": 0.9, "status": "active"},
        {"time": "13:00", "task": "Bio-Recovery", "intensity": 0.2, "status": "pending"},
        {"time": "15:00", "task": "Skill Engraving", "intensity": 0.7, "status": "pending"},
        {"time": "18:00", "task": "Progress Consolidation", "intensity": 0.5, "status": "pending"},
        {"time": "21:00", "task": "Rest State Sync", "intensity": 0.1, "status": "pending"}
    ]
    return jsonify({
        "day": "Cycle 01",
        "efficiency": 84,
        "schedule": schedule
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"[*] Life Engine online (Vite Proxy: http://localhost:{port})")
    app.run(host='0.0.0.0', port=port, debug=True)
