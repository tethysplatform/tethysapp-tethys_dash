import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import { useState } from 'react';
import DashboardCol from 'components/modals/NewDashboardCol';

function DashboardRow({rowNumber}) {
    const [colCount, setColCount]  = useState(2);
    const [rowHeight, setRowHeight]  = useState(25);

    function onColNumInput({target:{value}}) {
        setColCount(parseInt(value))
    }

    function onRowHeightInput({target:{value}}) {
        setRowHeight(parseInt(value))
    }

    function addDashboardCols() {
        const Cols = []
        const initialColWidth = Math.round(12/colCount)
        for (let i =1; i <= colCount; i++) {
            Cols.push(<DashboardCol rowNumber={rowNumber} colNumber={i} initialColWidth={initialColWidth}/>)
        }
        return Cols
    }

    return (
        <>
            <Row>
                <Col className="col-2 m-0 px-1">
                    <Form.Group className="mb-1" controlId={"row" + rowNumber + "height"}>
                        <Form.Control required type="number" onChange={onRowHeightInput} value={rowHeight} />
                    </Form.Group>
                </Col>
                <Col className="col-2 m-0 px-1">
                    <Form.Group className="mb-1" controlId={"row" + rowNumber + "colcount"}>
                        <Form.Control required type="number" onChange={onColNumInput} value={colCount} />
                    </Form.Group>
                </Col>
                <Col className="col-8 m-0">
                    <Row className="h-100">
                        {addDashboardCols()}
                    </Row>
                </Col>
            </Row>
        </>
    )
}

export default DashboardRow;