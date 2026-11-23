/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection =
      app.findCollectionByNameOrId("email_records") ||
      app.findCollectionByNameOrId("pbc_3362328056");
    if (!collection) return;

    const addFieldIfMissing = (fieldDef) => {
      if (!collection.fields.getByName(fieldDef.name)) {
        collection.fields.add(new Field(fieldDef));
      }
    };

    addFieldIfMissing({
      name: "ai_category",
      type: "text",
      max: 120,
    });

    addFieldIfMissing({
      name: "ai_confidence",
      type: "number",
    });

    addFieldIfMissing({
      name: "ai_tags",
      type: "json",
    });

    addFieldIfMissing({
      name: "ai_analysis",
      type: "json",
    });

    addFieldIfMissing({
      name: "ai_analyzed_at",
      type: "text",
      max: 64,
    });

    addFieldIfMissing({
      name: "header_signals",
      type: "json",
    });

    return app.save(collection);
  },
  (app) => {
    const collection =
      app.findCollectionByNameOrId("email_records") ||
      app.findCollectionByNameOrId("pbc_3362328056");
    if (!collection) return;

    for (const name of [
      "ai_category",
      "ai_confidence",
      "ai_tags",
      "ai_analysis",
      "ai_analyzed_at",
      "header_signals",
    ]) {
      const f = collection.fields.getByName(name);
      if (f) collection.fields.removeById(f.id);
    }

    return app.save(collection);
  }
);
