class EmailSummary {
  final String id;
  final int seq;
  final int uid;
  final String name;
  final String email;
  final String subject;
  final DateTime date;
  final bool read;
  final bool flagged;
  final List<String> flags;
  final String? snippet;

  const EmailSummary({
    required this.id,
    required this.seq,
    required this.uid,
    required this.name,
    required this.email,
    required this.subject,
    required this.date,
    required this.read,
    required this.flagged,
    this.flags = const [],
    this.snippet,
  });

  bool get isUnread => !read;
  bool get isFlagged => flagged;
  String get fromAddress => email;
  String get senderName => name;
  String get displayName => name.trim().isNotEmpty
      ? name.trim()
      : (email.trim().isNotEmpty ? email.trim() : 'Unbekannt');

  factory EmailSummary.fromJson(Map<String, dynamic> json) {
    final fromMap = json['from'] as Map<String, dynamic>?;
    final rawName = (json['name'] as String?) ?? (fromMap?['name'] as String?);
    final rawEmail = (json['email'] as String?) ?? (fromMap?['address'] as String?);
    final senderName = (rawName != null && rawName.trim().isNotEmpty)
        ? rawName.trim()
        : ((rawEmail != null && rawEmail.trim().isNotEmpty)
            ? rawEmail.trim()
            : 'Unbekannt');
    final senderEmail = (rawEmail != null && rawEmail.trim().isNotEmpty)
        ? rawEmail.trim()
        : '';

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

    final rawRead = json['read'];
    final rawIsUnread = json['isUnread'];
    final isRead = rawRead is bool
        ? rawRead
        : (rawIsUnread is bool ? !rawIsUnread : false);

    final rawFlagged = json['flagged'] ?? json['isFlagged'];
    final isFlagged = rawFlagged is bool ? rawFlagged : false;

    final rawFlags = json['flags'];
    final flagsList = rawFlags is List
        ? rawFlags.map((e) => e.toString()).toList()
        : <String>[];

    final rawDate = json['date'] as String?;
    final parsedDate = rawDate != null
        ? DateTime.tryParse(rawDate) ?? DateTime.now()
        : DateTime.now();

    final rawSubject = json['subject'] as String?;
    final subject = (rawSubject == null || rawSubject.trim().isEmpty)
        ? '(Kein Betreff)'
        : rawSubject;

    final rawSnippet = json['snippet'] as String?;

    return EmailSummary(
      id: json['id']?.toString() ?? seq.toString(),
      seq: seq,
      uid: uid,
      name: senderName.trim().isEmpty ? 'Unbekannt' : senderName,
      email: senderEmail,
      subject: subject,
      date: parsedDate,
      read: isRead,
      flagged: isFlagged,
      flags: flagsList,
      snippet: rawSnippet,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'seq': seq,
        'uid': uid,
        'name': name,
        'email': email,
        'from': {'name': name, 'address': email},
        'subject': subject,
        'date': date.toIso8601String(),
        'read': read,
        'isUnread': isUnread,
        'flagged': flagged,
        'isFlagged': isFlagged,
        'flags': flags,
        'snippet': snippet,
      };

  EmailSummary copyWith({
    String? id,
    int? seq,
    int? uid,
    String? name,
    String? email,
    String? subject,
    DateTime? date,
    bool? read,
    bool? flagged,
    List<String>? flags,
    String? snippet,
  }) {
    return EmailSummary(
      id: id ?? this.id,
      seq: seq ?? this.seq,
      uid: uid ?? this.uid,
      name: name ?? this.name,
      email: email ?? this.email,
      subject: subject ?? this.subject,
      date: date ?? this.date,
      read: read ?? this.read,
      flagged: flagged ?? this.flagged,
      flags: flags ?? this.flags,
      snippet: snippet ?? this.snippet,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is EmailSummary &&
          runtimeType == other.runtimeType &&
          id == other.id &&
          seq == other.seq &&
          read == other.read &&
          flagged == other.flagged;

  @override
  int get hashCode => Object.hash(id, seq, read, flagged);

  @override
  String toString() =>
      'EmailSummary(seq: $seq, from: $name <$email>, subject: $subject, date: $date, read: $read, flagged: $flagged)';
}
