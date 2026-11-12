/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("email_records");
  if (!collection) return;

  const existingFieldNames = new Set();
  for (let i = 0; i < collection.fields.length; i++) {
    existingFieldNames.add(collection.fields[i].name);
  }

  const fieldsToAdd = [
    new NumberField({ name: "uid" }),
    new TextField({ name: "html", max: 10000000 }),
    new TextField({ name: "text", max: 10000000 }),
    new BoolField({ name: "read" }),
    new BoolField({ name: "flagged" }),
    new JSONField({ name: "attachments" }),
    new JSONField({ name: "to" }),
    new JSONField({ name: "cc" }),
    new JSONField({ name: "from" }),
  ];

  for (const f of fieldsToAdd) {
    if (!existingFieldNames.has(f.name)) {
      collection.fields.add(f);
    }
  }

  app.save(collection);
}, (app) => {});
