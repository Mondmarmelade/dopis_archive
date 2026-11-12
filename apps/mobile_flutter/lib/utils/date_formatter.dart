class GermanDateFormatter {
  static const List<String> germanMonthsShort = [
    'Jan.',
    'Feb.',
    'Mär.',
    'Apr.',
    'Mai',
    'Juni',
    'Juli',
    'Aug.',
    'Sep.',
    'Okt.',
    'Nov.',
    'Dez.',
  ];

  /// Formats a [DateTime] according to Dopis German mail list specifications:
  /// - Today: "HH:mm" (e.g. "14:05")
  /// - Current year: "d. MMM" (e.g. "12. Mär.")
  /// - Prior years: "dd.MM.yyyy" (e.g. "14.03.2025")
  static String format(DateTime date, {DateTime? now}) {
    final current = now ?? DateTime.now();

    final isToday = date.year == current.year &&
        date.month == current.month &&
        date.day == current.day;

    if (isToday) {
      final hour = date.hour.toString().padLeft(2, '0');
      final minute = date.minute.toString().padLeft(2, '0');
      return '$hour:$minute';
    }

    final isThisYear = date.year == current.year;
    if (isThisYear) {
      final monthName = germanMonthsShort[date.month - 1];
      return '${date.day}. $monthName';
    }

    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    return '$day.$month.${date.year}';
  }
}
