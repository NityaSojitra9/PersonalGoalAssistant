"""
models.py
Database models for the Personal Goal Assistant.
Defines schema for Missions, Subtasks, Habits, and Habit Logs using SQLAlchemy.
"""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from typing import Dict, Any, List

db = SQLAlchemy()

class Mission(db.Model):
    """
    Represents a high-level personal goal/mission.
    """
    __tablename__ = 'missions'
    id = db.Column(db.Integer, primary_key=True)
    goal = db.Column(db.String(500), nullable=False)
    intensity = db.Column(db.String(50), default='balanced')
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    is_completed = db.Column(db.Boolean, default=False)
    
    # Relationship to subtasks
    subtasks = db.relationship('Subtask', backref='mission', lazy=True, cascade="all, delete-orphan")

    def to_dict(self) -> Dict[str, Any]:
        """
        Serializes the Mission object to a dictionary.
        """
        return {
            'id': self.id,
            'goal': self.goal,
            'intensity': self.intensity,
            'timestamp': self.timestamp.isoformat(),
            'is_completed': self.is_completed,
            'subtasks': [s.to_dict() for s in self.subtasks]
        }

class Subtask(db.Model):
    """
    Represents an actionable subtask derived from a Mission.
    """
    __tablename__ = 'subtasks'
    id = db.Column(db.Integer, primary_key=True)
    mission_id = db.Column(db.Integer, db.ForeignKey('missions.id'), nullable=False)
    text = db.Column(db.String(500), nullable=False)
    is_completed = db.Column(db.Boolean, default=False)
    order = db.Column(db.Integer, default=0)

    def to_dict(self) -> Dict[str, Any]:
        """
        Serializes the Subtask object to a dictionary.
        """
        return {
            'id': self.id,
            'text': self.text,
            'is_completed': self.is_completed,
            'order': self.order
        }

class Habit(db.Model):
    """
    Represents a recurring habit being tracked.
    """
    __tablename__ = 'habits'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    cue = db.Column(db.String(200)) # The behavioral trigger
    reward = db.Column(db.String(200)) # The craving satisfaction
    frequency = db.Column(db.String(50), default='daily')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    logs = db.relationship('HabitLog', backref='habit', lazy=True, cascade="all, delete-orphan")

    def to_dict(self) -> Dict[str, Any]:
        """
        Serializes the Habit object to a dictionary.
        """
        return {
            'id': self.id,
            'name': self.name,
            'cue': self.cue,
            'reward': self.reward,
            'frequency': self.frequency,
            'created_at': self.created_at.isoformat(),
            'logs': [l.to_dict() for l in self.logs]
        }

class HabitLog(db.Model):
    """
    Represents an execution record for a Habit.
    """
    __tablename__ = 'habit_logs'
    id = db.Column(db.Integer, primary_key=True)
    habit_id = db.Column(db.Integer, db.ForeignKey('habits.id'), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(50), default='completed') # e.g., 'completed', 'missed'

    def to_dict(self) -> Dict[str, Any]:
        """
        Serializes the HabitLog object to a dictionary.
        """
        return {
            'id': self.id,
            'habit_id': self.habit_id,
            'timestamp': self.timestamp.isoformat(),
            'status': self.status
        }
