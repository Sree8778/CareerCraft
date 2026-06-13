import 'package:flutter/material.dart';
import 'package:recruit_edge/api/api_service.dart';
import 'package:recruit_edge/theme/app_theme.dart';
import 'package:recruit_edge/widgets/glass_card.dart';

class FeaturedJobsSection extends StatefulWidget {
  const FeaturedJobsSection({super.key});

  @override
  State<FeaturedJobsSection> createState() => _FeaturedJobsSectionState();
}

class _FeaturedJobsSectionState extends State<FeaturedJobsSection> {
  late Future<List<Map<String, dynamic>>> _futureJobs;

  @override
  void initState() {
    super.initState();
    _futureJobs = fetchJobs();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Featured Job Opportunities',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 28),
          ),
          const SizedBox(height: 24),
          FutureBuilder<List<Map<String, dynamic>>>(
            future: _futureJobs,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              } else if (snapshot.hasError || !snapshot.hasData || snapshot.data!.isEmpty) {
                return const Center(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 20.0),
                    child: Text('No featured job opportunities available right now.', style: TextStyle(color: Colors.grey)),
                  ),
                );
              }

              final jobs = snapshot.data!.take(3).toList();

              return ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: jobs.length,
                itemBuilder: (context, index) {
                  final job = jobs[index];

                  return GlassCard(
                    onTap: () {
                      print('Tapped on job: ${job['title']}');
                    },
                    child: ListTile(
                      title: Text(job['title'] ?? 'Job Title', style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.bold)),
                      subtitle: Text('${job['company'] ?? 'CareerCraft Client'} - ${job['location'] ?? 'Remote'}', style: Theme.of(context).textTheme.bodyMedium),
                      trailing: const Icon(Icons.arrow_forward_ios),
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
                print('View All Jobs tapped');
              },
              child: const Text('View All Jobs'),
            ),
          ),
        ],
      ),
    );
  }
}

