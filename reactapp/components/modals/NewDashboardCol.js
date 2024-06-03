import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import { useState } from 'react';

function DashboardCol({rowNumber, colNumber, initialColWidth}) {
    const [colWidth, setColWidth]  = useState(initialColWidth);

    function onRowInput({target:{value}}) {
        setColWidth(parseInt(value))
    }

    return (
        <>
            <Col className="m-0 p-0">
                <Form.Group className="mb-0" controlId={"row" + rowNumber + "col" + colNumber}>
                    <Form.Control required type="number" min="1" onChange={onRowInput} value={colWidth} />
                </Form.Group>
            </Col>
        </>
    )
}

export default DashboardCol;