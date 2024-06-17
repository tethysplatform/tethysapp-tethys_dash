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
    row_data = Column(String)


def add_new_dashboard(label, name, image, notes, row_data):
    """
    Persist new dam.
    """
    # Create new Dam record
    new_dashboard = Dashboard(
        label=label,
        name=name,
        image=image,
        notes=notes,
        row_data=row_data
    )
    # [
        # {
            # "height":50,"columns":[
                # {"id":"166d56ad-00ba-46b5-9af7-8df78300a7de", "width":12,"type":"USACEPlot","metadata":{"location":"coy","year":"2024"}}
            # ]
        # },{
            # "height":50,"columns":[
                # {"id":"e34c4935-2ee6-4dcb-97ac-90b0d229c710", "width":4,"type":"Image","metadata":{"uri":"https://cw3e.ucsd.edu/Projects/QPF/images/HUC8/table_18010110.png"}},
                # {"id":"172f85c4-64b7-4031-815b-0c20de36d4fd", "width":8,"type":"CDECPlot","metadata":{"station":"dlv","start":"2024-06-01"}}
            # ]
        # },{
            # "height":25,"columns":[
                # {"id":"88b892fd-7b71-461d-b07f-146476d16313", "width":6,"type":"","metadata":{}},
                # {"id":"5d2f61b6-c815-45b1-836f-1bc3791b2841", "width":6,"type":"","metadata":{}}
            # ]
        # }
    # ]

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


def update_named_dashboard(name, label, image, notes, row_data):
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
    dashboard.row_data = row_data

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