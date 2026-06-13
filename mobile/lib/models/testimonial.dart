class Testimonial {
  final String quote;
  final String name;
  final String title;
  final String emoji;

  Testimonial({required this.quote, required this.name, required this.title, required this.emoji});

  factory Testimonial.fromJson(Map<String, dynamic> json) {
    return Testimonial(
      quote: json['quote'],
      name: json['name'],
      title: json['title'],
      emoji: json['emoji'],
    );
  }
}