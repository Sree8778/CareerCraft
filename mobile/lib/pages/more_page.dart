import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:recruit_edge/widgets/glass_card.dart';
import 'package:recruit_edge/pages/candidate_applications_page.dart';
import 'package:recruit_edge/pages/candidate_profile_page.dart';
import 'package:recruit_edge/pages/candidate_resume_builder_page.dart';
import 'package:recruit_edge/pages/candidate_interview_page.dart';
import 'package:recruit_edge/pages/network_page.dart';
import 'package:recruit_edge/pages/companies_page.dart';

/// "More" hub — everything that doesn't fit the bottom nav.
/// Mirrors the web sidebar's grouped structure.
class MorePage extends StatelessWidget {
  const MorePage({super.key});

  void _open(BuildContext context, Widget page, String title) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => Scaffold(
        appBar: AppBar(title: Text(title)),
        body: page,
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;

    final groups = <String, List<Map<String, dynamic>>>{
      'Job Search': [
        {'icon': Icons.description_outlined, 'label': 'My Applications', 'page': const CandidateApplicationsPage()},
        {'icon': Icons.business_outlined, 'label': 'Companies', 'page': const CompaniesPage()},
      ],
      'Prepare': [
        {'icon': Icons.edit_document, 'label': 'Resume Builder', 'page': const CandidateResumeBuilderPage()},
        {'icon': Icons.videocam_outlined, 'label': 'AI Interview', 'page': const CandidateInterviewPage()},
      ],
      'Connect': [
        {'icon': Icons.hub_outlined, 'label': 'Network', 'page': const NetworkPage()},
      ],
      'Account': [
        {'icon': Icons.person_outline, 'label': 'My Profile', 'page': const CandidateProfilePage()},
      ],
    };

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Identity header
          GlassCard(
            child: ListTile(
              leading: CircleAvatar(
                radius: 22,
                child: Text(
                  (user?.displayName ?? user?.email ?? 'M').isNotEmpty
                      ? (user?.displayName ?? user?.email ?? 'M')[0].toUpperCase()
                      : 'M',
                ),
              ),
              title: Text(user?.displayName ?? 'My Account',
                  style: const TextStyle(fontWeight: FontWeight.bold)),
              subtitle: Text(user?.email ?? '', style: const TextStyle(fontSize: 12)),
            ),
          ),
          const SizedBox(height: 16),

          for (final entry in groups.entries) ...[
            Padding(
              padding: const EdgeInsets.only(left: 4, bottom: 6),
              child: Text(
                entry.key.toUpperCase(),
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.5,
                  color: Colors.grey.shade500,
                ),
              ),
            ),
            GlassCard(
              child: Column(
                children: [
                  for (final item in entry.value)
                    ListTile(
                      leading: Icon(item['icon'] as IconData, size: 22),
                      title: Text(item['label'] as String,
                          style: const TextStyle(fontSize: 14)),
                      trailing: const Icon(Icons.chevron_right, size: 18),
                      onTap: () => _open(
                          context, item['page'] as Widget, item['label'] as String),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          OutlinedButton.icon(
            onPressed: () => FirebaseAuth.instance.signOut(),
            icon: const Icon(Icons.logout, size: 18),
            label: const Text('Sign out'),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}
