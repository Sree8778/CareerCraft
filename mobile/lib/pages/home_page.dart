import 'package:flutter/material.dart';
import 'package:recruit_edge/widgets/hero_section.dart';
import 'package:recruit_edge/widgets/features_grid_section.dart';
import 'package:recruit_edge/widgets/featured_jobs_section.dart';
import 'package:recruit_edge/widgets/featured_employers_section.dart';
import 'package:recruit_edge/widgets/built_for_everyone_section.dart';
import 'package:recruit_edge/widgets/footer_section.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return const SingleChildScrollView(
      child: Column(
        children: [
          HeroSection(),
          Divider(), // Visual separator
          FeaturesGridSection(),
          Divider(),
          FeaturedJobsSection(),
          Divider(),
          FeaturedEmployersSection(),
          Divider(),
          BuiltForEveryoneSection(),
          FooterSection(),
        ],
      ),
    );
  }
}
