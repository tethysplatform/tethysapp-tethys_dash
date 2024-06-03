import os
import uuid
import json
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, Float, String, ARRAY
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
    row_heights = Column(String)
    col_widths = Column(String)
    col_data = Column(String)


def add_new_dashboard(label, name, image, notes, row_heights, col_widths, col_data):
    """
    Persist new dam.
    """
    # Create new Dam record
    new_dashboard = Dashboard(
        label=label,
        name=name,
        image=image,
        notes=notes,
        row_heights=row_heights,
        col_widths=col_widths,
        col_data=col_data
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


def update_named_dashboard(name, label, image, notes, row_heights, col_widths, col_data):
    """
    Persist new dam.
    """
    # Get connection/session to database
    Session = app.get_persistent_store_database('primary_db', as_sessionmaker=True)
    session = Session()

    dashboard = session.query(Dashboard).filter(Dashboard.name==name).first()
    dashboard.label = label
    dashboard.image = image
    dashboard.notes = notes
    dashboard.row_heights = row_heights
    dashboard.col_widths = col_widths
    dashboard.col_data = col_data

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
    dashboards = session.query(Dashboard).order_by(Dashboard.name).all()

    session.close()

    return dashboards


def init_primary_db(engine, first_time):
    """
    Initializer for the primary database.
    """
    # Create all the tables
    Base.metadata.create_all(engine)