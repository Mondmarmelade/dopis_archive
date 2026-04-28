import React, { useState, useEffect } from "react";
import "../styles/EmailListItem.css";

const EmailListItem = ({ element }) => {
  return (
    <div className="email-list-item" style={{ width: "100%" }}>
      <img
        src={`https://img.logo.dev/${
          element.envelope.from[0].address.split("@")[1]
        }?token=pk_c9vsTZFXTmm9jB_Ace1d2w`}
      />
      {/* <input type="checkbox"></input> */}
      <p className="address">
        {element.envelope.from[0].name !== ""
          ? element.envelope.from[0].name
          : element.envelope.from[0].address}
      </p>
      <p>{element.envelope.subject}</p>
    </div>
  );
};

export default EmailListItem;
