import 'package:flutter/material.dart';
import 'package:recruit_edge/api/api_service.dart';
import 'package:recruit_edge/widgets/glass_card.dart';
import 'package:firebase_auth/firebase_auth.dart';

class CompanyDetailsPage extends StatefulWidget {
  final Map<String, dynamic> company;

  const CompanyDetailsPage({super.key, required this.company});

  @override
  State<CompanyDetailsPage> createState() => _CompanyDetailsPageState();
}

class _CompanyDetailsPageState extends State<CompanyDetailsPage> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<dynamic> _reviews = [];
  List<dynamic> _qna = [];
  Map<String, dynamic> _salaries = {};
  String _selectedTitle = "Flutter Developer";

  bool _isLoadingReviews = true;
  bool _isLoadingQna = true;
  bool _isLoadingSalaries = true;

  // Review Submissions controllers
  final TextEditingController _reviewController = TextEditingController();
  int _overallRating = 5;
  int _wlbRating = 5;
  int _compRating = 5;
  bool _isSubmittingReview = false;

  // Question Submission controllers
  final TextEditingController _questionController = TextEditingController();
  bool _isSubmittingQuestion = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _loadAllCompanyMetrics();
  }

  Future<void> _loadAllCompanyMetrics() async {
    _loadReviews();
    _loadQna();
    _loadSalaries();
  }

  Future<void> _loadReviews() async {
    try {
      final data = await fetchCompanyReviews(widget.company['id']);
      setState(() {
        _reviews = data;
        _isLoadingReviews = false;
      });
    } catch (e) {
      print('Error loading company reviews: $e');
      setState(() {
        _isLoadingReviews = false;
      });
    }
  }

  Future<void> _loadQna() async {
    try {
      final data = await fetchCompanyQnA(widget.company['id']);
      setState(() {
        _qna = data;
        _isLoadingQna = false;
      });
    } catch (e) {
      print('Error loading QnA: $e');
      setState(() {
        _isLoadingQna = false;
      });
    }
  }

  Future<void> _loadSalaries() async {
    try {
      final data = await fetchSalaryStats();
      setState(() {
        if (data != null) {
          _salaries = data;
          if (_salaries.keys.isNotEmpty) {
            _selectedTitle = _salaries.keys.first;
          }
        }
        _isLoadingSalaries = false;
      });
    } catch (e) {
      print('Error loading salary statistics: $e');
      setState(() {
        _isLoadingSalaries = false;
      });
    }
  }

  Future<void> _submitReview() async {
    final text = _reviewController.text.trim();
    if (text.isEmpty) return;

    setState(() {
      _isSubmittingReview = true;
    });

    try {
      final review = await submitCompanyReview(
        companyId: widget.company['id'],
        rating: _overallRating,
        workLifeBalance: _wlbRating,
        compensation: _compRating,
        reviewText: text,
      );

      if (review != null) {
        _reviewController.clear();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Colors.green,
            content: Text('Anonymous employee review successfully submitted!'),
          ),
        );
        _loadReviews();
      } else {
        throw Exception('Submission returned null');
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: Colors.red[800],
          content: Text('Failed to submit review: $e'),
        ),
      );
    } finally {
      setState(() {
        _isSubmittingReview = false;
      });
    }
  }

  Future<void> _submitQuestion() async {
    final text = _questionController.text.trim();
    if (text.isEmpty) return;

    setState(() {
      _isSubmittingQuestion = true;
    });

    try {
      final user = FirebaseAuth.instance.currentUser;
      final askedBy = user?.displayName ?? 'Candidate';

      final question = await submitCompanyQuestion(
        companyId: widget.company['id'],
        question: text,
        askedBy: askedBy,
      );

      if (question != null) {
        _questionController.clear();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Colors.green,
            content: Text('Your question was successfully posted to the forum!'),
          ),
        );
        _loadQna();
      } else {
        throw Exception('Question returned null');
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: Colors.red[800],
          content: Text('Question posting failed: $e'),
        ),
      );
    } finally {
      setState(() {
        _isSubmittingQuestion = false;
      });
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _reviewController.dispose();
    _questionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final company = widget.company;

    return Scaffold(
      backgroundColor: isDarkMode ? const Color(0xFF0F0C20) : Colors.white,
      appBar: AppBar(
        title: Text(company['name'] ?? 'Company Details', style: const TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: IconThemeData(color: isDarkMode ? Colors.white : Colors.black),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.deepPurpleAccent,
          labelColor: Colors.deepPurpleAccent,
          unselectedLabelColor: isDarkMode ? Colors.white60 : Colors.black54,
          tabs: const [
            Tab(text: 'Overview'),
            Tab(text: 'Reviews'),
            Tab(text: 'Forum'),
            Tab(text: 'Salaries'),
          ],
        ),
      ),
      body: SafeArea(
        child: TabBarView(
          controller: _tabController,
          children: [
            _buildOverviewTab(isDarkMode),
            _buildReviewsTab(isDarkMode),
            _buildQnaTab(isDarkMode),
            _buildSalariesTab(isDarkMode),
          ],
        ),
      ),
    );
  }

  Widget _buildOverviewTab(bool isDarkMode) {
    final company = widget.company;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Branding Card
          GlassCard(
            child: Padding(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 35,
                    backgroundColor: Colors.deepPurpleAccent.withOpacity(0.1),
                    backgroundImage: company['logoUrl'] != null
                        ? NetworkImage(company['logoUrl'])
                        : null,
                    child: company['logoUrl'] == null
                        ? const Icon(Icons.business, size: 40, color: Colors.deepPurpleAccent)
                        : null,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    company['name'] ?? '',
                    style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  Text(
                    company['industry'] ?? '',
                    style: const TextStyle(color: Colors.deepPurpleAccent, fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Detailed Bio
          Text(
            'About the Company',
            style: TextStyle(
              color: isDarkMode ? Colors.white : Colors.black87,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            company['bio'] ?? 'No bio information listed.',
            style: TextStyle(
              color: isDarkMode ? Colors.white70 : Colors.black87,
              fontSize: 13,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 24),

          // Meta Info List
          GlassCard(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                children: [
                  _buildMetaRow('Headquarters', company['location'] ?? 'N/A', Icons.location_on),
                  const Divider(color: Colors.white12, height: 20),
                  _buildMetaRow('Employee Size', company['employeesCount'] ?? 'N/A', Icons.people),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetaRow(String title, String desc, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: Colors.deepPurpleAccent, size: 20),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(color: Colors.grey, fontSize: 11)),
            Text(desc, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
          ],
        ),
      ],
    );
  }

  Widget _buildReviewsTab(bool isDarkMode) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Submission form
          GlassCard(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Anonymous Review', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  
                  // Score input dropdowns
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Overall star score:', style: TextStyle(color: Colors.grey, fontSize: 12)),
                      DropdownButton<int>(
                        value: _overallRating,
                        dropdownColor: const Color(0xFF0F0C20),
                        items: List.generate(5, (i) => i + 1).map((val) {
                          return DropdownMenuItem(value: val, child: Text('$val Stars', style: const TextStyle(color: Colors.white, fontSize: 12)));
                        }).toList(),
                        onChanged: (val) {
                          if (val != null) setState(() { _overallRating = val; });
                        },
                      ),
                    ],
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Work Life Balance:', style: TextStyle(color: Colors.grey, fontSize: 12)),
                      DropdownButton<int>(
                        value: _wlbRating,
                        dropdownColor: const Color(0xFF0F0C20),
                        items: List.generate(5, (i) => i + 1).map((val) {
                          return DropdownMenuItem(value: val, child: Text('$val/5', style: const TextStyle(color: Colors.white, fontSize: 12)));
                        }).toList(),
                        onChanged: (val) {
                          if (val != null) setState(() { _wlbRating = val; });
                        },
                      ),
                    ],
                  ),
                  
                  const SizedBox(height: 8),
                  TextField(
                    controller: _reviewController,
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                    maxLines: 3,
                    decoration: InputDecoration(
                      hintText: 'Share your honest feedback on WLB, compensation...',
                      fillColor: Colors.white.withOpacity(0.05),
                      filled: true,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _isSubmittingReview
                      ? const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent))
                      : ElevatedButton(
                          onPressed: _submitReview,
                          style: ElevatedButton.styleFrom(backgroundColor: Colors.deepPurpleAccent),
                          child: const Text('Post Anonymously', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                        ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Reviews List
          const Text('Employee Feed', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
          const SizedBox(height: 10),
          _isLoadingReviews
              ? const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent))
              : _reviews.isEmpty
                  ? const Text('No reviews yet. Be the first to share review stats!', style: TextStyle(color: Colors.grey, fontSize: 12))
                  : Column(
                      children: _reviews.map((rev) {
                        return GlassCard(
                          margin: const EdgeInsets.only(bottom: 12),
                          child: Padding(
                            padding: const EdgeInsets.all(16.0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Row(
                                      children: [
                                        const Icon(Icons.star, color: Colors.amber, size: 16),
                                        const SizedBox(width: 4),
                                        Text('${rev['rating']}/5 Stars', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                                      ],
                                    ),
                                    Text(
                                      rev['timestamp'] != null ? rev['timestamp'].toString().split('T')[0] : 'Recent',
                                      style: const TextStyle(color: Colors.grey, fontSize: 10),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 10),
                                Text(
                                  '"${rev['reviewText']}"',
                                  style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.4, fontStyle: FontStyle.italic),
                                ),
                                const SizedBox(height: 12),
                                const Divider(color: Colors.white10),
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    Text('WLB: ${rev['workLifeBalance']}/5', style: const TextStyle(color: Colors.deepPurpleAccent, fontSize: 11, fontWeight: FontWeight.bold)),
                                    const SizedBox(width: 16),
                                    Text('Compensation: ${rev['compensation']}/5', style: const TextStyle(color: Colors.deepPurpleAccent, fontSize: 11, fontWeight: FontWeight.bold)),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        );
                      }).toList(),
                    ),
        ],
      ),
    );
  }

  Widget _buildQnaTab(bool isDarkMode) {
    return Column(
      children: [
        // Question submission text field
        Padding(
          padding: const EdgeInsets.all(16.0),
          child: GlassCard(
            child: Padding(
              padding: const EdgeInsets.all(12.0),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _questionController,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: const InputDecoration(
                        hintText: 'Ask about culture, interview format...',
                        border: InputBorder.none,
                        contentPadding: EdgeInsets.symmetric(horizontal: 12),
                      ),
                    ),
                  ),
                  _isSubmittingQuestion
                      ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.deepPurpleAccent))
                      : IconButton(
                          icon: const Icon(Icons.send, color: Colors.deepPurpleAccent),
                          onPressed: _submitQuestion,
                        ),
                ],
              ),
            ),
          ),
        ),

        // Questions List
        Expanded(
          child: _isLoadingQna
              ? const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent))
              : _qna.isEmpty
                  ? const Center(child: Text('No forum topics posted. Start discussions!', style: TextStyle(color: Colors.grey, fontSize: 12)))
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: _qna.length,
                      itemBuilder: (context, idx) {
                        final thread = _qna[idx];
                        return GlassCard(
                          margin: const EdgeInsets.only(bottom: 12),
                          child: Padding(
                            padding: const EdgeInsets.all(16.0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    const Icon(Icons.help_outline, color: Colors.deepPurpleAccent, size: 20),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        thread['question'] ?? '',
                                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                                      ),
                                    ),
                                  ],
                                ),
                                if (thread['answer'] != null && thread['answer'].toString().isNotEmpty) ...[
                                  const SizedBox(height: 12),
                                  const Divider(color: Colors.white10),
                                  const SizedBox(height: 8),
                                  Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Icon(Icons.check_circle_outline, color: Colors.green, size: 16),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          thread['answer'],
                                          style: const TextStyle(color: Colors.white70, fontSize: 12, height: 1.4),
                                        ),
                                      ),
                                    ],
                                  ),
                                ] else ...[
                                  const SizedBox(height: 8),
                                  const Text(
                                    'Awaiting response from hiring recruiters...',
                                    style: TextStyle(color: Colors.grey, fontSize: 11, fontStyle: FontStyle.italic),
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
    );
  }

  Widget _buildSalariesTab(bool isDarkMode) {
    if (_isLoadingSalaries) {
      return const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent));
    }

    if (_salaries.isEmpty) {
      return const Center(child: Text('No salary aggregator data found.', style: TextStyle(color: Colors.grey, fontSize: 12)));
    }

    final data = _salaries[_selectedTitle] ?? { 'low': 70000, 'median': 100000, 'high': 130000, 'curve': [20, 45, 60, 90, 60, 45, 20] };
    final List<dynamic> curve = data['curve'] ?? [20, 45, 60, 90, 60, 45, 20];
    final List<double> curvePoints = curve.map((c) => double.parse(c.toString())).toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Title selector
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Target job role:', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
              DropdownButton<String>(
                value: _selectedTitle,
                dropdownColor: const Color(0xFF0F0C20),
                items: _salaries.keys.map((title) {
                  return DropdownMenuItem(value: title, child: Text(title, style: const TextStyle(color: Colors.white, fontSize: 12)));
                }).toList(),
                onChanged: (val) {
                  if (val != null) setState(() { _selectedTitle = val; });
                },
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Ranges Display
          GlassCard(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildSalaryColumn('Low (10%)', '\$${(data['low'] as int).toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}', Colors.grey),
                  _buildSalaryColumn('Median', '\$${(data['median'] as int).toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}', Colors.deepPurpleAccent),
                  _buildSalaryColumn('High (90%)', '\$${(data['high'] as int).toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}', Colors.grey),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Custom Painted curve widget
          const Text('Competitive Pay Range Curve', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
          const SizedBox(height: 12),
          Container(
            height: 150,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.black.withOpacity(0.3),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white12),
            ),
            child: CustomPaint(
              painter: SalaryCurvePainter(curvePoints: curvePoints),
              child: const SizedBox.expand(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSalaryColumn(String label, String value, Color color) {
    return Column(
      children: [
        Text(label, style: const TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        Text(value, style: TextStyle(color: color, fontSize: 16, fontWeight: FontWeight.bold, fontFamily: 'monospace')),
      ],
    );
  }
}

// Custom Painter to draw salary distribution curve graph on canvas
class SalaryCurvePainter extends CustomPainter {
  final List<double> curvePoints;

  SalaryCurvePainter({required this.curvePoints});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.deepPurpleAccent
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.5;

    final fillPaint = Paint()
      ..style = PaintingStyle.fill;

    final path = Path();
    final fillPath = Path();

    final double segmentWidth = size.width / (curvePoints.length - 1);
    
    // Starting point
    path.moveTo(0, size.height);
    fillPath.moveTo(0, size.height);

    for (int i = 0; i < curvePoints.length; i++) {
      final double x = i * segmentWidth;
      // Map score from 0-100 to size.height (leaving margins at bottom)
      final double y = size.height - (curvePoints[i] / 100.0) * (size.height - 20);
      
      if (i == 0) {
        path.lineTo(x, y);
        fillPath.lineTo(x, y);
      } else {
        final double prevX = (i - 1) * segmentWidth;
        final double prevY = size.height - (curvePoints[i - 1] / 100.0) * (size.height - 20);
        
        // Control points for cubic bezier curves
        final double controlX1 = prevX + segmentWidth / 2;
        final double controlY1 = prevY;
        final double controlX2 = prevX + segmentWidth / 2;
        final double controlY2 = y;
        
        path.cubicTo(controlX1, controlY1, controlX2, controlY2, x, y);
        fillPath.cubicTo(controlX1, controlY1, controlX2, controlY2, x, y);
      }
    }

    fillPath.lineTo(size.width, size.height);
    fillPath.close();

    // Create shader for premium curve gradient
    final gradient = LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: [
        Colors.deepPurpleAccent.withOpacity(0.35),
        Colors.deepPurpleAccent.withOpacity(0.0),
      ],
    );
    fillPaint.shader = gradient.createShader(Rect.fromLTWH(0, 0, size.width, size.height));

    canvas.drawPath(fillPath, fillPaint);
    canvas.drawPath(path, paint);

    // Median vertical divider dashed line
    final medianPaint = Paint()
      ..color = Colors.deepPurpleAccent.withOpacity(0.5)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    const double dashHeight = 5;
    const double dashSpace = 4;
    double startY = 0;
    final double medianX = size.width / 2;

    while (startY < size.height) {
      canvas.drawLine(Offset(medianX, startY), Offset(medianX, startY + dashHeight), medianPaint);
      startY += dashHeight + dashSpace;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
