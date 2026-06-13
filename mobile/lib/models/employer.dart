class Employer {
  final String name;
  final String industry;
  final String logoUrl;

  Employer({required this.name, required this.industry, required this.logoUrl});

  factory Employer.fromJson(Map<String, dynamic> json) {
    return Employer(
      name: json['name'],
      industry: json['industry'],
      logoUrl: json['logoUrl'],
    );
  }
}