class ActionItem {
  final String task;
  final String? due;
  final bool completed;

  const ActionItem({
    required this.task,
    this.due,
    this.completed = false,
  });

  factory ActionItem.fromJson(Map<String, dynamic> json) {
    return ActionItem(
      task: json['task'] as String? ?? '',
      due: json['due'] as String?,
      completed: json['completed'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
        'task': task,
        'due': due,
        'completed': completed,
      };

  ActionItem copyWith({
    String? task,
    String? due,
    bool? completed,
  }) {
    return ActionItem(
      task: task ?? this.task,
      due: due ?? this.due,
      completed: completed ?? this.completed,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ActionItem &&
          runtimeType == other.runtimeType &&
          task == other.task &&
          due == other.due &&
          completed == other.completed;

  @override
  int get hashCode => Object.hash(task, due, completed);

  @override
  String toString() => 'ActionItem(task: $task, due: $due, completed: $completed)';
}

class PaymentInfo {
  final bool isPaymentReceipt;
  final String? provider;
  final String? paidTo;
  final String? amount;
  final String? transactionId;

  const PaymentInfo({
    required this.isPaymentReceipt,
    this.provider,
    this.paidTo,
    this.amount,
    this.transactionId,
  });

  factory PaymentInfo.fromJson(Map<String, dynamic> json) {
    return PaymentInfo(
      isPaymentReceipt: json['isPaymentReceipt'] as bool? ?? true,
      provider: json['provider'] as String?,
      paidTo: json['paidTo'] as String?,
      amount: json['amount'] as String?,
      transactionId: json['transactionId'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'isPaymentReceipt': isPaymentReceipt,
        'provider': provider,
        'paidTo': paidTo,
        'amount': amount,
        'transactionId': transactionId,
      };
}

class OrderInfo {
  final bool isOrder;
  final String? orderType;
  final String? merchant;
  final String? orderId;
  final String? trackingNumber;
  final String? carrier;
  final String? productSummary;
  final String? amount;
  final String? stage;
  final String? statusTitle;
  final String? statusDetail;
  final String? eventDate;
  final String? venue;
  final String? deliveryLocation;
  final String? estimatedDelivery;

  const OrderInfo({
    required this.isOrder,
    this.orderType,
    this.merchant,
    this.orderId,
    this.trackingNumber,
    this.carrier,
    this.productSummary,
    this.amount,
    this.stage,
    this.statusTitle,
    this.statusDetail,
    this.eventDate,
    this.venue,
    this.deliveryLocation,
    this.estimatedDelivery,
  });

  factory OrderInfo.fromJson(Map<String, dynamic> json) {
    return OrderInfo(
      isOrder: json['isOrder'] as bool? ?? true,
      orderType: json['orderType'] as String?,
      merchant: json['merchant'] as String?,
      orderId: json['orderId'] as String?,
      trackingNumber: json['trackingNumber'] as String?,
      carrier: json['carrier'] as String?,
      productSummary: json['productSummary'] as String?,
      amount: json['amount'] as String?,
      stage: json['stage'] as String?,
      statusTitle: json['statusTitle'] as String?,
      statusDetail: json['statusDetail'] as String?,
      eventDate: json['eventDate'] as String?,
      venue: json['venue'] as String?,
      deliveryLocation: json['deliveryLocation'] as String?,
      estimatedDelivery: json['estimatedDelivery'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'isOrder': isOrder,
        'orderType': orderType,
        'merchant': merchant,
        'orderId': orderId,
        'trackingNumber': trackingNumber,
        'carrier': carrier,
        'productSummary': productSummary,
        'amount': amount,
        'stage': stage,
        'statusTitle': statusTitle,
        'statusDetail': statusDetail,
        'eventDate': eventDate,
        'venue': venue,
        'deliveryLocation': deliveryLocation,
        'estimatedDelivery': estimatedDelivery,
      };
}

class AiAnalysisResult {
  final List<String> summary;
  final String category;
  final List<String> tags;
  final List<ActionItem> actionItems;
  final PaymentInfo? paymentInfo;
  final OrderInfo? orderInfo;

  const AiAnalysisResult({
    required this.summary,
    required this.category,
    this.tags = const [],
    this.actionItems = const [],
    this.paymentInfo,
    this.orderInfo,
  });

  factory AiAnalysisResult.fromJson(Map<String, dynamic> json) {
    final rawSummary = json['summary'];
    final summaryList = rawSummary is List
        ? rawSummary.map((e) => e.toString()).toList()
        : rawSummary != null
            ? [rawSummary.toString()]
            : <String>[];

    final rawTags = json['tags'];
    final tagsList = rawTags is List
        ? rawTags.map((e) => e.toString()).toList()
        : <String>[];

    final rawActions = json['actionItems'] as List?;
    final actionList = rawActions != null
        ? rawActions
            .map((e) => ActionItem.fromJson(e as Map<String, dynamic>))
            .toList()
        : <ActionItem>[];

    final paymentMap = json['paymentInfo'] as Map<String, dynamic>?;
    final orderMap = json['orderInfo'] as Map<String, dynamic>?;

    return AiAnalysisResult(
      summary: summaryList,
      category: json['category'] as String? ?? 'Sonstiges',
      tags: tagsList,
      actionItems: actionList,
      paymentInfo: paymentMap != null ? PaymentInfo.fromJson(paymentMap) : null,
      orderInfo: orderMap != null ? OrderInfo.fromJson(orderMap) : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'summary': summary,
        'category': category,
        'tags': tags,
        'actionItems': actionItems.map((e) => e.toJson()).toList(),
        'paymentInfo': paymentInfo?.toJson(),
        'orderInfo': orderInfo?.toJson(),
      };

  AiAnalysisResult copyWith({
    List<String>? summary,
    String? category,
    List<String>? tags,
    List<ActionItem>? actionItems,
    PaymentInfo? paymentInfo,
    OrderInfo? orderInfo,
  }) {
    return AiAnalysisResult(
      summary: summary ?? this.summary,
      category: category ?? this.category,
      tags: tags ?? this.tags,
      actionItems: actionItems ?? this.actionItems,
      paymentInfo: paymentInfo ?? this.paymentInfo,
      orderInfo: orderInfo ?? this.orderInfo,
    );
  }

  @override
  String toString() =>
      'AiAnalysisResult(category: $category, summary: ${summary.length} items, actions: ${actionItems.length} items)';
}
