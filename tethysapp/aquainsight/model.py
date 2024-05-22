import os
import uuid
import json
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, Float, String
from sqlalchemy.orm import sessionmaker

from .app import App as app

Base = declarative_base()


# SQLAlchemy ORM definition for the dams table
class Dashboard(Base):
    """
    SQLAlchemy Dashboard DB Model
    """
    __tablename__ = 'dashboards'

    # Columns
    id = Column(Integer, primary_key=True)
    name = Column(String)
    image = Column(String)
    notes = Column(String)
    rows = Column(String)


def add_new_dashboard(name, image, notes, rows):
    """
    Persist new dam.
    """
    # Create new Dam record
    new_dashboard = Dashboard(
        name=name,
        image=image,
        notes=notes,
        rows=rows
    )
    #add_new_dashboard("mendocino", "https://images.pexels.com/photos/247600/pexels-photo-247600.jpeg", "Here are some potential notes about the dashboard or what user have seen recently in the graphs", {"row1": {"col1": {"type": "plot","width": "100"}},"row2": {"col1": {"type": "plot","width": "33"},"col2": {"type": "plot","width": "33"},"col3": {"type": "plot","width": "33"}}})

    # Get connection/session to database
    Session = app.get_persistent_store_database('primary_db', as_sessionmaker=True)
    session = Session()

    # Add the new dam record to the session
    session.add(new_dashboard)

    # Commit the session and close the connection
    session.commit()
    session.close()


def get_all_dashboards():
    """
    Get all persisted dashboards.
    """
    # Get connection/session to database
    Session = app.get_persistent_store_database('primary_db', as_sessionmaker=True)
    session = Session()

    # Query for all dam records
    dashboards = session.query(Dashboard).all()
    session.close()

    return dashboards


def init_primary_db(engine, first_time):
    """
    Initializer for the primary database.
    """
    # Create all the tables
    Base.metadata.create_all(engine)