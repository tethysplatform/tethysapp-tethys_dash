import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import { useState } from 'react';
import DashboardCol from 'components/modals/NewDashboardCol';

function DashboardRow({rowNumber, initialRowHeight, initialRowColWidths, initialRowColData}) {
    let initialColCount;
    if (initialRowColWidths) {
        initialColCount = initialRowColWidths.length
    } else {
        initialColCount = 2
    }

    if (!initialRowHeight) {
        initialRowHeight = 25
    }

    const [colCount, setColCount]  = useState(initialColCount);
    const [rowHeight, setRowHeight]  = useState(initialRowHeight);

    function onColNumInput({target:{value}}) {
        setColCount(parseInt(value))
    }

    function onRowHeightInput({target:{value}}) {
        setRowHeight(parseInt(value))
    }

    function addDashboardCols() {
        const Cols = []
        for (let i =1; i <= colCount; i++) {
            let initialColWidth
            if (initialRowColWidths) {
                initialColWidth = initialRowColWidths[i-1]
            } else {
                initialColWidth = Math.round(12/colCount)
            }
            Cols.push(<DashboardCol key={i} rowNumber={rowNumber} colNumber={i} initialColWidth={initialColWidth}/>)
        }
        return Cols
    }

    return (
        <>
            <Row>
                <Col className="col-2 m-0 px-1">
                    <Form.Group className="mb-1" controlId={"row" + rowNumber + "height"}>
                        <Form.Control required type="number" min="1" onChange={onRowHeightInput} value={rowHeight} />
                    </Form.Group>
                </Col>
                <Col className="col-2 m-0 px-1">
                    <Form.Group className="mb-1" controlId={"row" + rowNumber + "colcount"}>
                        <Form.Control required type="number" min="1" onChange={onColNumInput} value={colCount} />
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