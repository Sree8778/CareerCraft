class Benefit {
  final String title;
  final String desc;
  final String icon;

  Benefit({required this.title, required this.desc, required this.icon});

  factory Benefit.fromJson(Map<String, dynamic> json) {
    return Benefit(
      title: json['title'],
      desc: json['desc'],
      icon: json['icon'],
    );
  }
}