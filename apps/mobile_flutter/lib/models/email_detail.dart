class EmailRecipient {
  final String name;
  final String address;

  const EmailRecipient({required this.name, required this.address});

  factory EmailRecipient.fromJson(Map<String, dynamic> json) {
    return EmailRecipient(
      name: json['name'] as String? ?? '',
      address: json['address'] as String? ?? json['email'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {'name': name, 'address': address};

  @override
  String toString() => name.isNotEmpty ? '$name <$address>' : address;
}

class EmailAttachment {
  final String filename;
  final String mimeType;
  final String disposition;
  final int size;

  const EmailAttachment({
    required this.filename,
    required this.mimeType,
    required this.disposition,
    required this.size,
  });

  String get formattedSize {
    if (size < 1024) return '$size B';
    if (size < 1024 * 1024) return '${(size / 1024).toStringAsFixed(1)} KB';
    return '${(size / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  factory EmailAttachment.fromJson(Map<String, dynamic> json) {
    return EmailAttachment(
      filename: json['filename'] as String? ?? 'Anhang',
      mimeType: json['mimeType'] as String? ?? 'application/octet-stream',
      disposition: json['disposition'] as String? ?? 'attachment',
      size: (json['size'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
        'filename': filename,
        'mimeType': mimeType,
        'disposition': disposition,
        'size': size,
      };
}

class EmailDetail {
  final String id;
  final int seq;
  final int uid;
  final String subject;
  final EmailRecipient from;
  final List<EmailRecipient> to;
  final List<EmailRecipient> cc;
  final DateTime date;
  final String? html;
  final String? text;
  final List<EmailAttachment> attachments;
  final List<String> flags;
  final bool read;
  final bool flagged;

  const EmailDetail({
    required this.id,
    required this.seq,
    required this.uid,
    required this.subject,
    required this.from,
    required this.to,
    required this.cc,
    required this.date,
    this.html,
    this.text,
    this.attachments = const [],
    this.flags = const [],
    required this.read,
    required this.flagged,
  });

  String get name => from.name.isNotEmpty ? from.name : from.address;
  String get email => from.address;
  bool get hasHtml => html != null && html!.trim().isNotEmpty;
  bool get hasText => text != null && text!.trim().isNotEmpty;
  bool get hasAttachments => attachments.isNotEmpty;
  bool get isUnread => !read;
  bool get isFlagged => flagged;

  factory EmailDetail.fromJson(Map<String, dynamic> json) {
    final fromMap = json['from'] as Map<String, dynamic>? ?? {};
    final from = EmailRecipient(
      name: fromMap['name'] as String? ?? json['name'] as String? ?? '',
      address: fromMap['address'] as String? ?? json['email'] as String? ?? '',
    );

    final toList = (json['to'] as List?)
            ?.map((e) => EmailRecipient.fromJson(
                e is Map ? Map<String, dynamic>.from(e) : <String, dynamic>{}))
            .toList() ??
        [];

    final ccList = (json['cc'] as List?)
            ?.map((e) => EmailRecipient.fromJson(
                e is Map ? Map<String, dynamic>.from(e) : <String, dynamic>{}))
            .toList() ??
        [];

    final attList = (json['attachments'] as List?)
            ?.map((e) => EmailAttachment.fromJson(
                e is Map ? Map<String, dynamic>.from(e) : <String, dynamic>{}))
            .toList() ??
        [];

    final rawSeq = json['seq'];
    final seq = rawSeq is int
        ? rawSeq
        : int.tryParse(rawSeq?.toString() ?? '') ??
            int.tryParse(json['id']?.toString() ?? '') ??
            0;

    final rawUid = json['uid'];
    final uid = rawUid is int
        ? rawUid
        : int.tryParse(rawUid?.toString() ?? '') ?? seq;

    final flagsList =
        (json['flags'] as List?)?.map((e) => e.toString()).toList() ?? [];

    final rawRead = json['read'];
    final rawIsUnread = json['isUnread'];
    final isRead = rawRead is bool
        ? rawRead
        : (rawIsUnread is bool ? !rawIsUnread : false);

    final rawFlagged = json['flagged'] ?? json['isFlagged'];
    final isFlagged = rawFlagged is bool ? rawFlagged : false;

    return EmailDetail(
      id: json['id']?.toString() ?? seq.toString(),
      seq: seq,
      uid: uid,
      subject: (json['subject'] as String?)?.trim().isEmpty ?? true
          ? '(Kein Betreff)'
          : json['subject'] as String,
      from: from,
      to: toList,
      cc: ccList,
      date: DateTime.tryParse(json['date'] as String? ?? '') ?? DateTime.now(),
      html: json['html'] as String?,
      text: json['text'] as String?,
      attachments: attList,
      flags: flagsList,
      read: isRead,
      flagged: isFlagged,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'seq': seq,
        'uid': uid,
        'subject': subject,
        'from': from.toJson(),
        'name': from.name,
        'email': from.address,
        'to': to.map((e) => e.toJson()).toList(),
        'cc': cc.map((e) => e.toJson()).toList(),
        'date': date.toIso8601String(),
        'html': html,
        'text': text,
        'attachments': attachments.map((e) => e.toJson()).toList(),
        'flags': flags,
        'read': read,
        'flagged': flagged,
      };

  EmailDetail copyWith({
    String? id,
    int? seq,
    int? uid,
    String? subject,
    EmailRecipient? from,
    List<EmailRecipient>? to,
    List<EmailRecipient>? cc,
    DateTime? date,
    String? html,
    String? text,
    List<EmailAttachment>? attachments,
    List<String>? flags,
    bool? read,
    bool? flagged,
  }) {
    return EmailDetail(
      id: id ?? this.id,
      seq: seq ?? this.seq,
      uid: uid ?? this.uid,
      subject: subject ?? this.subject,
      from: from ?? this.from,
      to: to ?? this.to,
      cc: cc ?? this.cc,
      date: date ?? this.date,
      html: html ?? this.html,
      text: text ?? this.text,
      attachments: attachments ?? this.attachments,
      flags: flags ?? this.flags,
      read: read ?? this.read,
      flagged: flagged ?? this.flagged,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is EmailDetail &&
          runtimeType == other.runtimeType &&
          id == other.id &&
          seq == other.seq &&
          read == other.read &&
          flagged == other.flagged;

  @override
  int get hashCode => Object.hash(id, seq, read, flagged);
}
