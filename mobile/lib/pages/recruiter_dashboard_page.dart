import 'package:flutter/material.dart';
import 'package:recruit_edge/theme/app_theme.dart';
import 'package:recruit_edge/widgets/glass_card.dart';
import 'package:recruit_edge/pages/recruiter_requisitions_page.dart';
import 'package:recruit_edge/pages/recruiter_candidates_page.dart';
import 'package:recruit_edge/pages/recruiter_job_post_page.dart';
import 'package:recruit_edge/pages/recruiter_messages_page.dart';
import 'package:recruit_edge/pages/recruiter_sourcing_page.dart';
import 'package:recruit_edge/pages/companies_page.dart';
import 'package:recruit_edge/pages/recruiter_webhooks_page.dart';
import 'package:recruit_edge/api/api_service.dart';

class RecruiterDashboardPage extends StatelessWidget {
  const RecruiterDashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Recruiter Dashboard',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 20),
            GlassCard(
              child: ListTile(
                leading: const Icon(Icons.business_center_outlined, color: Colors.deepPurpleAccent),
                title: Text('My Requisitions', style: Theme.of(context).textTheme.bodyLarge),
                subtitle: Text('Manage your open job requisitions.', style: Theme.of(context).textTheme.bodyMedium),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const RecruiterRequisitionsPage()),
                  );
                },
              ),
            ),
            GlassCard(
              child: ListTile(
                leading: const Icon(Icons.group_outlined, color: Colors.deepPurpleAccent),
                title: Text('Candidates', style: Theme.of(context).textTheme.bodyLarge),
                subtitle: Text('View and manage candidate profiles.', style: Theme.of(context).textTheme.bodyMedium),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const RecruiterCandidatesPage()),
                  );
                },
              ),
            ),
            GlassCard(
              child: ListTile(
                leading: const Icon(Icons.post_add, color: Colors.deepPurpleAccent),
                title: Text('Post New Job', style: Theme.of(context).textTheme.bodyLarge),
                subtitle: Text('Create a new job posting.', style: Theme.of(context).textTheme.bodyMedium),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const RecruiterJobPostPage()),
                  );
                },
              ),
            ),
            GlassCard(
              child: ListTile(
                leading: const Icon(Icons.forum_outlined, color: Colors.deepPurpleAccent),
                title: Text('Message Center', style: Theme.of(context).textTheme.bodyLarge),
                subtitle: Text('Chat in real-time with applicants.', style: Theme.of(context).textTheme.bodyMedium),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const RecruiterMessagesPage()),
                  );
                },
              ),
            ),
            GlassCard(
              child: ListTile(
                leading: const Icon(Icons.psychology_outlined, color: Colors.deepPurpleAccent),
                title: Text('AI Candidate Sourcing', style: Theme.of(context).textTheme.bodyLarge),
                subtitle: Text('Squeeze candidate pools with compound filters.', style: Theme.of(context).textTheme.bodyMedium),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const RecruiterSourcingPage()),
                  );
                },
              ),
            ),
            GlassCard(
              child: ListTile(
                leading: const Icon(Icons.business_outlined, color: Colors.deepPurpleAccent),
                title: Text('Company Directory', style: Theme.of(context).textTheme.bodyLarge),
                subtitle: Text('Browse employer profiles, reviews and salaries.', style: Theme.of(context).textTheme.bodyMedium),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const CompaniesPage()),
                  );
                },
              ),
            ),
            GlassCard(
              child: ListTile(
                leading: const Icon(Icons.webhook_outlined, color: Colors.deepPurpleAccent),
                title: Text('Webhook Integrations', style: Theme.of(context).textTheme.bodyLarge),
                subtitle: Text('Manage real-time notifications to external systems.', style: Theme.of(context).textTheme.bodyMedium),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const RecruiterWebhooksPage()),
                  );
                },
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Recent Applications',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 10),
            FutureBuilder<List<Map<String, dynamic>>>(
              future: fetchCandidates(),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent));
                } else if (snapshot.hasError || !snapshot.hasData || snapshot.data!.isEmpty) {
                  return const GlassCard(
                    child: Padding(
                      padding: EdgeInsets.all(16.0),
                      child: Text(
                        'No recent applications at the moment.',
                        style: TextStyle(color: Colors.grey),
                      ),
                    ),
                  );
                }

                final candidates = snapshot.data!.take(2).toList();
                return Column(
                  children: candidates.map((cand) {
                    return GlassCard(
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Application for ${cand['title'] ?? 'Software Professional'}',
                                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.bold),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Candidate: ${cand['name'] ?? 'Anonymous'} • Location: ${cand['location'] ?? 'Remote'}',
                                    style: Theme.of(context).textTheme.bodyMedium,
                                  ),
                                ],
                              ),
                            ),
                            const Icon(Icons.arrow_forward_ios, size: 16),
                          ],
                        ),
                      ),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => const RecruiterCandidatesPage(),
                          ),
                        );
                      },
                    );
                  }).toList(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}