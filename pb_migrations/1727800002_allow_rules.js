/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  for (const name of ["orders", "receipts", "email_records"]) {
    const col = app.findCollectionByNameOrId(name);
    if (col) {
      col.listRule = "";
      col.viewRule = "";
      col.createRule = "";
      col.updateRule = "";
      col.deleteRule = "";
      app.save(col);
    }
  }
}, (app) => {});
