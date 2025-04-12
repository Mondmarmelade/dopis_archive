import React, { useState, useEffect } from "react";
import "../styles/EmailModal.css";

const EmailModalWindow = () => {
  const [emailSeq, setEmailSeq] = useState();

  useEffect(() => {
    setEmailSeq(100);
  }, []);

  useEffect(() => {
    console.log(emailSeq);
  }, [emailSeq]);

  if (emailSeq !== undefined)
    return (
      <div className="modal">
        <div class="modal-content">
          <span class="close">&times;</span>
          <p>Some text in the Modal..</p>
        </div>
      </div>
    );
};

export default EmailModalWindow;
