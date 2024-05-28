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
    label = Column(String)
    name = Column(String)
    image = Column(String)
    notes = Column(String)
    rows = Column(String)


def add_new_dashboard(label, name, image, notes, rows):
    """
    Persist new dam.
    """
    # Create new Dam record
    new_dashboard = Dashboard(
        label=label,
        name=name,
        image=image,
        notes=notes,
        rows=rows
    )

    # Get connection/session to database
    Session = app.get_persistent_store_database('primary_db', as_sessionmaker=True)
    session = Session()

    # Add the new dam record to the session
    session.add(new_dashboard)

    # Commit the session and close the connection
    session.commit()
    session.close()


def delete_named_dashboard(name):
    """
    Persist new dam.
    """
    # Get connection/session to database
    Session = app.get_persistent_store_database('primary_db', as_sessionmaker=True)
    session = Session()

    session.query(Dashboard).filter(Dashboard.name==name).delete()

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