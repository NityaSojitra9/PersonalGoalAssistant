import os
import sys
from flask import Flask, request, jsonify
from flask_cors import CORS

# Add project root to sys.path to allow importing from agent, models, etc.
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.append(project_root)

# Import agent logic
from agent.subtask_generation import generate_subtasks
from agent.task_execution import perform_subtask

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Database Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///goals.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

from backend.models import db, Mission, Subtask, Habit, HabitLog
db.init_app(app)

# Ensure database tables are created
with app.app_context():
    db.create_all()


@app.route('/run', methods=['POST'])
def run_agent():
    if request.is_json:
        data = request.get_json()
        goal = data.get('goal')
        intensity = data.get('intensity', 'balanced')
    else:
        goal = request.form.get('goal')
        intensity = request.form.get('intensity', 'balanced')

    if not goal:
        return jsonify({'error': 'No goal provided'}), 400

    print(f"[*] Starting agent with goal: {goal} [Intensity: {intensity}]")

    # Save Mission to DB
    new_mission = Mission(goal=goal, intensity=intensity)
    db.session.add(new_mission)
    db.session.commit()

    # Generate subtasks
    subtasks = generate_subtasks(goal, intensity=intensity)

    # Execute the subtasks & Save to DB
    agent_output = []
    for index, task_text in enumerate(subtasks, start=1):
        # Save Subtask to DB
        st = Subtask(mission_id=new_mission.id, text=task_text, order=index)
        db.session.add(st)
        
        status = perform_subtask(task_text)
        agent_output.append({
            'step': index,
            'action': task_text,
            'status': status
        })
    
    db.session.commit()

    # Re-fetch or use to_dict to get IDs
    mission_data = new_mission.to_dict()

    response = {
        'mission_id': new_mission.id,
        'result': f'Strategic objectives for "{goal}" have been materialized in the Mission Report.',
        'agent_output': agent_output,
        'subtasks': mission_data['subtasks']
    }
    return jsonify(response)


@app.route('/missions', methods=['GET'])
def get_missions():
    missions = Mission.query.order_by(Mission.timestamp.desc()).all()
    return jsonify([m.to_dict() for m in missions])

@app.route('/subtasks/<int:subtask_id>', methods=['PATCH'])
def update_subtask(subtask_id):
    data = request.get_json()
    subtask = Subtask.query.get_or_404(subtask_id)
    
    if 'is_completed' in data:
        subtask.is_completed = data['is_completed']
    
    db.session.commit()
    return jsonify({'success': True, 'subtask': subtask.to_dict()})


@app.route('/analytics/stats', methods=['GET'])
def get_analytics_stats():
    total_missions = Mission.query.count()
    completed_missions = Mission.query.filter_by(is_completed=True).count()
    
    # Success rate calculation
    success_rate = (completed_missions / total_missions * 100) if total_missions > 0 else 0
    
    # Intensity distribution
    blitz_count = Mission.query.filter_by(intensity='blitz').count()
    balanced_count = Mission.query.filter_by(intensity='balanced').count()
    mastery_count = Mission.query.filter_by(intensity='mastery').count()
    
    return jsonify({
        'totalMissions': total_missions,
        'completedMissions': completed_missions,
        'successRate': round(success_rate, 1),
        'distribution': {
            'blitz': blitz_count,
            'balanced': balanced_count,
            'mastery': mastery_count
        }
    })

@app.route('/analytics/topology', methods=['GET'])
def get_topology():
    # Fetch recent missions and their subtasks to build a graph structure
    missions = Mission.query.order_by(Mission.timestamp.desc()).limit(10).all()
    nodes = []
    links = []
    
    for i, m in enumerate(missions):
        mission_node_id = f"m_{m.id}"
        nodes.append({
            'id': mission_node_id,
            'label': m.goal,
            'type': 'mission',
            'intensity': m.intensity,
            'completed': m.is_completed
        })
        
        for st in m.subtasks:
            st_node_id = f"st_{st.id}"
            nodes.append({
                'id': st_node_id,
                'label': st.text,
                'type': 'subtask',
                'completed': st.is_completed
            })
            links.append({
                'source': mission_node_id,
                'target': st_node_id
            })
            
    return jsonify({'nodes': nodes, 'links': links})

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'Personal Goal Assistant API is running'})

# --- Quantum Forge Endpoints ---

@app.route('/forge/habits', methods=['GET', 'POST'])
def handle_habits():

    if request.method == 'GET':
        habits = Habit.query.all()
        return jsonify([h.to_dict() for h in habits])
    
    if request.method == 'POST':
        data = request.json
        new_habit = Habit(
            name=data.get('name'),
            cue=data.get('cue'),
            reward=data.get('reward'),
            frequency=data.get('frequency', 'daily')
        )
        db.session.add(new_habit)
        db.session.commit()
        return jsonify({'success': True, 'habit': new_habit.to_dict()})

@app.route('/forge/log', methods=['POST'])
def log_habit():
    data = request.json
    habit_id = data.get('habit_id')
    status = data.get('status', 'completed')
    
    log = HabitLog(habit_id=habit_id, status=status)
    db.session.add(log)
    db.session.commit()
    return jsonify({'success': True, 'log': log.to_dict()})

@app.route('/forge/predict', methods=['GET'])
def predict_future():
    # Sophisticated projection logic: 
    # Analyzes habit consistency over the last 30 days and projects outcomes
    habits = Habit.query.all()
    projections = []
    
    for h in habits:
        consistency = len(h.logs) / max(1, (datetime.utcnow() - h.created_at).days)
        consistency = min(1.0, consistency)
        
        # Identity-based personas based on consistency
        persona = "The Novice"
        if consistency > 0.8: persona = "The Master Architect"
        elif consistency > 0.5: persona = "The Dedicated Striver"
        
        projections.append({
            'habit': h.name,
            'consistency': round(consistency * 100, 1),
            'persona': persona,
            'prediction30Days': f"You will have solidified the '{h.name}' foundation.",
            'prediction365Days': f"The '{h.name}' behavior will be fully autonomous, defining your new identity."
        })
        
    return jsonify({
        'overallStanding': 'Resilient' if len(projections) > 0 else 'Initial Stage',
        'projections': projections
    })


if __name__ == '__main__':

    # Default port 5000
    port = int(os.environ.get('PORT', 5000))
    print(f"[*] Backend server starting on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=True)
