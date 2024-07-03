from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
import json

from .app import App as app

Base = declarative_base()


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
    rows = relationship("Row", order_by="Row.row_order.asc()", cascade="delete")


class Row(Base):
    """
    SQLAlchemy Dashboard DB Model
    """
    __tablename__ = 'rows'

    # Columns
    id = Column(Integer, primary_key=True)
    dashboard_id = Column(Integer, ForeignKey("dashboards.id"), nullable=False)
    row_order = Column(Integer)
    height = Column(Integer)
    columns = relationship("Column", order_by="Column.col_order.asc()", cascade="delete")


class Column(Base):
    """
    SQLAlchemy Dashboard DB Model
    """
    __tablename__ = 'columns'

    # Columns
    id = Column(Integer, primary_key=True)
    row_id = Column(Integer, ForeignKey("rows.id"), nullable=False)
    col_order = Column(Integer)
    width = Column(Integer)
    data_type = Column(String)
    data_metadata = Column(String)


def add_new_dashboard(label, name, image, notes, row_data):
    """
    Persist new dam.
    """
    # Get connection/session to database
    Session = app.get_persistent_store_database('primary_db', as_sessionmaker=True)
    session = Session()
    
    new_dashboard = Dashboard(
        label=label,
        name=name,
        image=image,
        notes=notes
    )

    session.add(new_dashboard)
    dashboard_id = session.query(Dashboard).filter(Dashboard.name==name).first().id
    
    row_data = json.loads(row_data)
    for index, row in enumerate(row_data):
        new_row = add_new_row(session, dashboard_id, index, row['height'])

        for index, column in enumerate(row['columns']):
            add_new_column(session, new_row.id, index, column['width'], column['type'], json.dumps(column['metadata']))
        
    # [
        # {
            # "height":50,"columns":[
                # {"width":12,"type":"USACEPlot","metadata":{"location":"coy","year":"2024"}}
            # ]
        # },{
            # "height":50,"columns":[
                # {"width":4,"type":"Image","metadata":{"uri":"https://cw3e.ucsd.edu/Projects/QPF/images/HUC8/table_18010110.png"}},
                # {"width":8,"type":"CDECPlot","metadata":{"station":"dlv","start":"2024-06-01"}}
            # ]
        # },{
            # "height":25,"columns":[
                # {"width":6,"type":"","metadata":{}},
                # {"width":6,"type":"","metadata":{}}
            # ]
        # }
    # ]

    # Commit the session and close the connection
    session.commit()
    session.close()


def add_new_row(session, dashboard_id, order, height):
    new_row = Row(
        dashboard_id=dashboard_id,
        row_order=order,
        height=height
    )
    session.add(new_row)
    session.commit()
    session.refresh(new_row)
    
    return new_row


def delete_row(session, row_id):
    db_row = session.query(Row).filter(Row.id==row_id).first()
    session.delete(db_row)
    
    return 


def add_new_column(session, row_id, order, width, type, metadata):
    new_column = Column(
        row_id=row_id,
        col_order=order,
        width=width,
        data_type=type,
        data_metadata=metadata
    )
    session.add(new_column)
    session.commit()
    session.refresh(new_column)
    
    return new_column


def delete_column(session, col_id):
    db_col = session.query(Column).filter(Column.id==col_id).first()
    session.delete(db_col)
    
    return 


def delete_named_dashboard(name):
    """
    Persist new dam.
    """
    # Get connection/session to database
    Session = app.get_persistent_store_database('primary_db', as_sessionmaker=True)
    session = Session()

    db_dashboard = session.query(Dashboard).filter(Dashboard.name==name).first()
    session.delete(db_dashboard)

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

    db_dashboard = session.query(Dashboard).filter(Dashboard.name==name).first()
    db_dashboard.label = label
    db_dashboard.image = image
    db_dashboard.notes = notes
    row_data = json.loads(row_data) if isinstance(row_data, str) else row_data

    existing_db_row_ids = [row.id for row in db_dashboard.rows]
    new_row_ids = [int(row['id']) for row in row_data if row.get('id')]
    rows_to_delete = [id for id in existing_db_row_ids if id not in new_row_ids]
    for row_id in rows_to_delete:
        delete_row(session, row_id)

    for row in row_data:
        row_id = row.get('id')
        row_height = int(row['height'])
        row_order = int(row['order'])
        if not row_id:
            db_row = add_new_row(session, db_dashboard.id, row_order, row_height)
        else:
            db_row = session.query(Row).filter(Row.id==row_id).first()
            db_row.height = row_height
            db_row.row_order = row_order

        existing_db_col_ids = [col.id for col in db_row.columns]
        new_col_ids = [int(col['id']) for col in row['columns'] if col.get('id')]
        cols_to_delete = [id for id in existing_db_col_ids if id not in new_col_ids]
        for col_id in cols_to_delete:
            delete_column(session, col_id)
        
        for col in row['columns']:
            col_id = col.get('id')
            col_width = int(col['width'])
            col_order = int(col['order'])
            col_type = col['type']
            col_metadata = json.dumps(col['metadata'])
            if not col_id:
                db_col = add_new_column(session, db_row.id, col_order, col_width, col_type, col_metadata)
            else:
                db_col = session.query(Column).filter(Column.id==col_id).first()
                db_col.width = col_width
                db_col.col_order = col_order
                db_col.data_type = col_type
                db_col.data_metadata = col_metadata
            

    # Commit the session and close the connection
    session.commit()
    session.close()


def get_dashboards(name=None):
    """
    Get all persisted dashboards.
    """
    dashboard_dict = {}
    # Get connection/session to database
    Session = app.get_persistent_store_database('primary_db', as_sessionmaker=True)
    session = Session()

    # Query for all dam records
    if name:
        dashboards = session.query(Dashboard).filter(Dashboard.name==name).all()
    else:
        dashboards = session.query(Dashboard).order_by(Dashboard.name).all()

    for dashboard in dashboards:
        dashboard_dict[dashboard.name] = {
            "id": dashboard.id,
            "name": dashboard.name,
            "label": dashboard.label,
            "image": dashboard.image,
            "notes": dashboard.notes
        }
        
        rows = []
        for row in dashboard.rows:
            row_data = {
                "id": row.id,
                "order": row.row_order,
                "height": row.height
            }
            cols = []
            for col in row.columns:
                col_data = {
                    "id": col.id,
                    "order": col.col_order,
                    "width": col.width,
                    "type": col.data_type,
                    "metadata": json.loads(col.data_metadata)
                }
                cols.append(col_data)
            
            row_data['columns'] = cols
            rows.append(row_data)
        
        
        dashboard_dict[dashboard.name]["rowData"] = rows

    session.close()

    return dashboard_dict


def init_primary_db(engine, first_time):
    """
    Initializer for the primary database.
    """
    # Create all the tables
    Base.metadata.create_all(engine)