import 'package:flutter/material.dart';
import 'package:recruit_edge/api/api_service.dart';
import 'package:recruit_edge/models/employer.dart';
import 'package:recruit_edge/theme/app_theme.dart';
import 'package:recruit_edge/widgets/glass_card.dart';

class FeaturedEmployersSection extends StatefulWidget {
  const FeaturedEmployersSection({super.key});

  @override
  State<FeaturedEmployersSection> createState() => _FeaturedEmployersSectionState();
}

class _FeaturedEmployersSectionState extends State<FeaturedEmployersSection> {
  late Future<List<Employer>> _futureEmployers;

  @override
  void initState() {
    super.initState();
    _futureEmployers = fetchFeaturedEmployers();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Top Employers',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 28),
          ),
          const SizedBox(height: 24),
          FutureBuilder<List<Employer>>(
            future: _futureEmployers,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              } else if (snapshot.hasError || !snapshot.hasData || snapshot.data!.isEmpty) {
                return const Center(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 20.0),
                    child: Text('No featured employers available right now.', style: TextStyle(color: Colors.grey)),
                  ),
                );
              }

              final employers = snapshot.data!.take(4).toList();

              return GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2, // 2 columns for mobile
                  crossAxisSpacing: 16.0,
                  mainAxisSpacing: 16.0,
                  childAspectRatio: 1.0, // Square cards
                ),
                itemCount: employers.length,
                itemBuilder: (context, index) {
                  final employer = employers[index];

                  return GlassCard(
                    onTap: () {
                      print('Tapped on employer: ${employer.name}');
                    },
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        employer.logoUrl.isNotEmpty
                            ? CircleAvatar(
                                radius: 24,
                                backgroundImage: NetworkImage(employer.logoUrl),
                                onBackgroundImageError: (exception, stackTrace) {},
                              )
                            : Icon(Icons.business, size: 48, color: Theme.of(context).primaryColor),
                        const SizedBox(height: 12),
                        Text(
                          employer.name,
                          style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.bold),
                          textAlign: TextAlign.center,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          employer.industry,
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontSize: 12),
                          textAlign: TextAlign.center,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  );
                },
              );
            },
          ),
          const SizedBox(height: 24),
          Center(
            child: ElevatedButton(
              onPressed: () {
                print('View All Employers tapped');
              },
              child: const Text('View All Employers'),
            ),
          ),
        ],
      ),
    );
  }
}

