class UserSession {
  final String token;
  final String email;
  final String host;
  final int port;
  final DateTime expiresAt;

  const UserSession({
    required this.token,
    required this.email,
    required this.host,
    required this.port,
    required this.expiresAt,
  });

  bool get isExpired => DateTime.now().isAfter(expiresAt);
  bool get isValid => token.isNotEmpty && !isExpired;

  factory UserSession.fromJson(Map<String, dynamic> json) {
    return UserSession(
      token: json['token'] as String? ?? '',
      email: json['email'] as String? ?? '',
      host: json['host'] as String? ?? '',
      port: (json['port'] as num?)?.toInt() ?? 993,
      expiresAt: DateTime.tryParse(json['expiresAt'] as String? ?? '') ??
          DateTime.now().add(const Duration(days: 14)),
    );
  }

  factory UserSession.fromLoginResponse(
    Map<String, dynamic> json, {
    required int port,
    String? defaultHost,
  }) {
    final userMap = json['user'] as Map<String, dynamic>?;
    return UserSession(
      token: json['token'] as String? ?? '',
      email: userMap?['email'] as String? ?? '',
      host: userMap?['host'] as String? ?? defaultHost ?? '',
      port: port,
      expiresAt: DateTime.tryParse(json['expiresAt'] as String? ?? '') ??
          DateTime.now().add(const Duration(days: 14)),
    );
  }

  Map<String, dynamic> toJson() => {
        'token': token,
        'email': email,
        'host': host,
        'port': port,
        'expiresAt': expiresAt.toIso8601String(),
      };

  UserSession copyWith({
    String? token,
    String? email,
    String? host,
    int? port,
    DateTime? expiresAt,
  }) {
    return UserSession(
      token: token ?? this.token,
      email: email ?? this.email,
      host: host ?? this.host,
      port: port ?? this.port,
      expiresAt: expiresAt ?? this.expiresAt,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is UserSession &&
          runtimeType == other.runtimeType &&
          token == other.token &&
          email == other.email &&
          host == other.host &&
          port == other.port &&
          expiresAt == other.expiresAt;

  @override
  int get hashCode => Object.hash(token, email, host, port, expiresAt);

  @override
  String toString() =>
      'UserSession(email: $email, host: $host:$port, expiresAt: $expiresAt)';
}
