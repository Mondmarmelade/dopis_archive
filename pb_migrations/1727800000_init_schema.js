/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // 1. Orders Collection
  const orders = new Collection({
    name: "orders",
    type: "base",
    listRule: "@request.auth.id != '' || user_email = @request.auth.email",
    viewRule: "@request.auth.id != '' || user_email = @request.auth.email",
    createRule: "@request.auth.id != '' || user_email = @request.auth.email",
    updateRule: "@request.auth.id != '' || user_email = @request.auth.email",
    deleteRule: "@request.auth.id != '' || user_email = @request.auth.email",
    fields: [
      { name: "user_email", type: "text", required: true },
      { name: "order_number", type: "text" },
      { name: "merchant", type: "text" },
      { name: "order_type", type: "text" },
      { name: "stage", type: "text" },
      { name: "status_title", type: "text" },
      { name: "status_detail", type: "text" },
      { name: "amount", type: "text" },
      { name: "carrier", type: "text" },
      { name: "tracking_number", type: "text" },
      { name: "order_date", type: "text" },
      { name: "raw_metadata", type: "json" },
    ],
  });
  app.save(orders);

  // 2. Receipts Collection
  const receipts = new Collection({
    name: "receipts",
    type: "base",
    listRule: "@request.auth.id != '' || user_email = @request.auth.email",
    viewRule: "@request.auth.id != '' || user_email = @request.auth.email",
    createRule: "@request.auth.id != '' || user_email = @request.auth.email",
    updateRule: "@request.auth.id != '' || user_email = @request.auth.email",
    deleteRule: "@request.auth.id != '' || user_email = @request.auth.email",
    fields: [
      { name: "user_email", type: "text", required: true },
      { name: "order", type: "relation", collectionId: orders.id, maxSelect: 1 },
      { name: "receipt_type", type: "text" },
      { name: "title", type: "text" },
      { name: "merchant", type: "text" },
      { name: "amount", type: "text" },
      { name: "provider", type: "text" },
      { name: "transaction_id", type: "text" },
      { name: "date", type: "text" },
      {
        name: "file",
        type: "file",
        maxSize: 15728640,
        mimeTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
      },
      { name: "source_mail_id", type: "text" },
      { name: "source_subject", type: "text" },
      { name: "notes", type: "text" },
      { name: "raw_metadata", type: "json" },
    ],
  });
  app.save(receipts);

  // 3. Email Records Collection
  const emailRecords = new Collection({
    name: "email_records",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    fields: [
      { name: "user_email", type: "text", required: true },
      { name: "message_id", type: "text" },
      { name: "seq", type: "number" },
      { name: "uid", type: "number" },
      { name: "folder", type: "text" },
      { name: "subject", type: "text" },
      { name: "sender_email", type: "text" },
      { name: "sender_name", type: "text" },
      { name: "date", type: "text" },
      { name: "html", type: "text", max: 10000000 },
      { name: "text", type: "text", max: 10000000 },
      { name: "read", type: "bool" },
      { name: "flagged", type: "bool" },
      { name: "attachments", type: "json" },
      { name: "to", type: "json" },
      { name: "cc", type: "json" },
      { name: "from", type: "json" },
      { name: "ai_summary", type: "json" },
      { name: "has_receipt", type: "bool" },
      { name: "is_order", type: "bool" },
    ],
  });
  app.save(emailRecords);
}, (app) => {
  try {
    const receipts = app.findCollectionByNameOrId("receipts");
    if (receipts) app.delete(receipts);
  } catch {}
  try {
    const orders = app.findCollectionByNameOrId("orders");
    if (orders) app.delete(orders);
  } catch {}
  try {
    const emailRecords = app.findCollectionByNameOrId("email_records");
    if (emailRecords) app.delete(emailRecords);
  } catch {}
});
