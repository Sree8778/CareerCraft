import 'package:flutter/material.dart';
import 'package:recruit_edge/api/api_service.dart';
import 'package:recruit_edge/widgets/glass_card.dart';
import 'package:recruit_edge/pages/recruiter_candidate_details_page.dart';

class RecruiterSourcingPage extends StatefulWidget {
  const RecruiterSourcingPage({super.key});

  @override
  State<RecruiterSourcingPage> createState() => _RecruiterSourcingPageState();
}

class _RecruiterSourcingPageState extends State<RecruiterSourcingPage> {
  final TextEditingController _copilotController = TextEditingController();
  final TextEditingController _skillsController = TextEditingController();
  final TextEditingController _locationController = TextEditingController();

  List<dynamic> _candidates = [];
  List<dynamic> _filtered = [];
  bool _isLoading = true;
  bool _runningCopilot = false;
  bool _copilotUsed = false;

  // Filter scales
  int _minExperience = 0;
  int _minProctor = 0;

  @override
  void initState() {
    super.initState();
    _loadCandidates();
  }

  Future<void> _loadCandidates() async {
    setState(() {
      _isLoading = true;
    });
    try {
      final list = await fetchCandidates();
      setState(() {
        _candidates = list;
        _filtered = list;
        _isLoading = false;
      });
    } catch (e) {
      print('Error loading candidates in sourcing: $e');
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _applyManualFilters() {
    setState(() {
      _copilotUsed = false;
      final querySkills = _skillsController.text.toLowerCase().trim();
      final queryLoc = _locationController.text.toLowerCase().trim();

      _filtered = _candidates.where((cand) {
        final skills = (cand['skills'] ?? '').toString().toLowerCase();
        final location = (cand['location'] ?? '').toString().toLowerCase();
        final score = cand['matchScore'] ?? cand['matchPercentage'] ?? 85;

        // Skills match
        if (querySkills.isNotEmpty && !skills.contains(querySkills)) {
          return false;
        }

        // Location match
        if (queryLoc.isNotEmpty && !location.contains(queryLoc)) {
          return false;
        }

        // Experience match
        if (_minExperience > 0) {
          final expStr = (cand['experience'] ?? '').toString();
          final regMatch = RegExp(r'(\d+)\s*years?').firstMatch(expStr);
          if (regMatch != null) {
            final years = int.parse(regMatch.group(1)!);
            if (years < _minExperience) return false;
          } else {
            // loose check
            if (_minExperience > 3) return false;
          }
        }

        // Proctor rating match
        if (_minProctor > 0 && score < _minProctor) {
          return false;
        }

        return true;
      }).toList();
    });
  }

  Future<void> _runCopilotSearch() async {
    final query = _copilotController.text.trim();
    if (query.isEmpty) return;

    setState(() {
      _runningCopilot = true;
    });

    try {
      final ranked = await searchCandidatesCopilot(query);
      setState(() {
        _filtered = ranked;
        _copilotUsed = true;
        _runningCopilot = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: Colors.green,
          content: Text('AI Copilot successfully prioritized ${_filtered.length} candidates.'),
        ),
      );
    } catch (e) {
      print('Copilot sourcing search failed: $e');
      setState(() {
        _runningCopilot = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Colors.red,
          content: Text('Copilot API search connection timed out.'),
        ),
      );
    }
  }

  void _resetAllFilters() {
    setState(() {
      _skillsController.clear();
      _locationController.clear();
      _copilotController.clear();
      _minExperience = 0;
      _minProctor = 0;
      _copilotUsed = false;
      _filtered = _candidates;
    });
  }

  @override
  void dispose() {
    _copilotController.dispose();
    _skillsController.dispose();
    _locationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDarkMode ? const Color(0xFF0F0C20) : Colors.white,
      appBar: AppBar(
        title: const Text('AI Candidate Sourcing', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: IconThemeData(color: isDarkMode ? Colors.white : Colors.black),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.deepPurpleAccent),
            onPressed: _resetAllFilters,
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // AI Copilot Search Bar
              GlassCard(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 6.0),
                  child: Row(
                    children: [
                      const Icon(Icons.psychology, color: Colors.deepPurpleAccent),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: _copilotController,
                          style: const TextStyle(color: Colors.white, fontSize: 13),
                          decoration: const InputDecoration(
                            hintText: 'Ask Copilot: "Find senior Flutter devs in Austin"',
                            border: InputBorder.none,
                          ),
                        ),
                      ),
                      _runningCopilot
                          ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.deepPurpleAccent))
                          : IconButton(
                              icon: const Icon(Icons.search, color: Colors.deepPurpleAccent),
                              onPressed: _runCopilotSearch,
                            ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Filter Slides Toggle sheets
              ExpansionTile(
                title: const Text('Advanced Search Filters', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
                iconColor: Colors.deepPurpleAccent,
                collapsedIconColor: Colors.grey,
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8.0),
                    child: Column(
                      children: [
                        TextField(
                          controller: _skillsController,
                          style: const TextStyle(color: Colors.white, fontSize: 12),
                          decoration: const InputDecoration(labelText: 'Required skills tags', labelStyle: TextStyle(color: Colors.grey)),
                          onChanged: (_) => _applyManualFilters(),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _locationController,
                          style: const TextStyle(color: Colors.white, fontSize: 12),
                          decoration: const InputDecoration(labelText: 'Location name', labelStyle: TextStyle(color: Colors.grey)),
                          onChanged: (_) => _applyManualFilters(),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Min Experience: $_minExperience years', style: const TextStyle(color: Colors.grey, fontSize: 11)),
                            Slider(
                              value: _minExperience.toDouble(),
                              min: 0,
                              max: 10,
                              divisions: 10,
                              activeColor: Colors.deepPurpleAccent,
                              onChanged: (val) {
                                setState(() { _minExperience = val.toInt(); });
                                _applyManualFilters();
                              },
                            ),
                          ],
                        ),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Min Proctor: $_minProctor%', style: const TextStyle(color: Colors.grey, fontSize: 11)),
                            Slider(
                              value: _minProctor.toDouble(),
                              min: 0,
                              max: 100,
                              divisions: 20,
                              activeColor: Colors.deepPurpleAccent,
                              onChanged: (val) {
                                setState(() { _minProctor = val.toInt(); });
                                _applyManualFilters();
                              },
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Listings
              Expanded(
                child: _isLoading
                    ? const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent))
                    : _filtered.isEmpty
                        ? const Center(
                            child: Text(
                              'No matching candidate profiles.',
                              style: TextStyle(color: Colors.grey),
                            ),
                          )
                        : ListView.builder(
                            itemCount: _filtered.length,
                            itemBuilder: (context, idx) {
                              final cand = _filtered[idx];
                              final score = cand['matchScore'] ?? cand['matchPercentage'];
                              
                              return GlassCard(
                                margin: const EdgeInsets.only(bottom: 12),
                                onTap: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (context) => RecruiterCandidateDetailsPage(candidateData: cand),
                                    ),
                                  );
                                },
                                child: Padding(
                                  padding: const EdgeInsets.all(16.0),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          CircleAvatar(
                                            backgroundColor: Colors.deepPurpleAccent.withOpacity(0.1),
                                            child: Text(
                                              cand['name'] != null ? cand['name'].toString().substring(0, 1).toUpperCase() : 'C',
                                              style: const TextStyle(color: Colors.deepPurpleAccent, fontWeight: FontWeight.bold),
                                            ),
                                          ),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  cand['name'] ?? 'Candidate Profile',
                                                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                                                ),
                                                Text(
                                                  cand['title'] ?? 'Technical Specialist',
                                                  style: const TextStyle(color: Colors.grey, fontSize: 12),
                                                ),
                                              ],
                                            ),
                                          ),
                                          if (score != null)
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                              decoration: BoxDecoration(color: const Color(0xFF10B981).withOpacity(0.15), borderRadius: BorderRadius.circular(8)),
                                              child: Text('$score%', style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 11)),
                                            ),
                                        ],
                                      ),
                                      const SizedBox(height: 12),
                                      const Divider(color: Colors.white10),
                                      const SizedBox(height: 6),
                                      Text(
                                        'Skills: ${cand['skills'] ?? "N/A"}',
                                        style: const TextStyle(color: Colors.white70, fontSize: 12),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        'Location: ${cand['location'] ?? "Remote"}',
                                        style: const TextStyle(color: Colors.grey, fontSize: 11),
                                      ),
                                      
                                      // AI Copilot Match Reasoning block
                                      if (cand['copilotReasoning'] != null && cand['copilotReasoning'].toString().isNotEmpty) ...[
                                        const SizedBox(height: 12),
                                        Container(
                                          padding: const EdgeInsets.all(10),
                                          decoration: BoxDecoration(
                                            color: Colors.deepPurpleAccent.withOpacity(0.06),
                                            borderRadius: BorderRadius.circular(10),
                                            border: Border.all(color: Colors.deepPurpleAccent.withOpacity(0.2)),
                                          ),
                                          child: Text(
                                            cand['copilotReasoning'],
                                            style: const TextStyle(color: Colors.white70, fontSize: 11, height: 1.4),
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
