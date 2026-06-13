import 'package:flutter/material.dart';
import 'package:recruit_edge/api/api_service.dart'; // New path
import 'package:recruit_edge/models/employer.dart'; // New path
import 'package:recruit_edge/widgets/glass_card.dart'; // New path

class FeaturedEmployersPage extends StatefulWidget {
  const FeaturedEmployersPage({super.key});

  @override
  State<FeaturedEmployersPage> createState() => _FeaturedEmployersPageState();
}

class _FeaturedEmployersPageState extends State<FeaturedEmployersPage> {
  late Future<List<Employer>> _futureEmployers;

  @override
  void initState() {
    super.initState();
    _futureEmployers = fetchFeaturedEmployers();
  }

  @override
  Widget build(BuildContext
      context) {
    return Scaffold(
      body: FutureBuilder<List<Employer>>(
        future: _futureEmployers,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          } else if (snapshot.hasError) {
            return Center(child: Text('Error: ${snapshot.error}'));
          } else if (snapshot.hasData) {
            return ListView.builder(
              itemCount: snapshot.data!.length,
              itemBuilder: (context, index) {
                final employer = snapshot.data![index];
                return GlassCard(
                  child: ListTile(
                    leading: employer.logoUrl.isNotEmpty
                        ? CircleAvatar(
                            backgroundImage: NetworkImage(employer.logoUrl),
                            onBackgroundImageError: (exception, stackTrace) {
                              // print('Error loading image: $exception'); // Commented out as per linting
                            },
                          )
                        : const CircleAvatar(child: Icon(Icons.business)),
                    title: Text(employer.name, style: Theme.of(context).textTheme.bodyLarge),
                    subtitle: Text(employer.industry, style: Theme.of(context).textTheme.bodyMedium),
                  ),
                );
              },
            );
          } else {
            return const Center(child: Text('No featured employers found.'));
          }
        },
      ),
    );
  }
}