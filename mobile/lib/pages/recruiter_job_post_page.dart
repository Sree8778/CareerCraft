import 'package:flutter/material.dart';
import 'package:recruit_edge/theme/app_theme.dart';
import 'package:recruit_edge/widgets/glass_card.dart';
import 'package:recruit_edge/api/api_service.dart';

class RecruiterJobPostPage extends StatefulWidget {
  const RecruiterJobPostPage({super.key});

  @override
  State<RecruiterJobPostPage> createState() => _RecruiterJobPostPageState();
}

class _RecruiterJobPostPageState extends State<RecruiterJobPostPage> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _descriptionController = TextEditingController();
  String _selectedJobType = 'Full-time';
  bool _isLoading = false;
  String? _responseMessage;

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _postJob() async {
    if (_formKey.currentState!.validate()) {
      setState(() {
        _isLoading = true;
        _responseMessage = null;
      });

      try {
        final success = await postJob(
          title: _titleController.text,
          description: _descriptionController.text,
          jobType: _selectedJobType,
        );

        if (success && mounted) {
          setState(() {
            _responseMessage = 'Job Posted Successfully!';
            _titleController.clear();
            _descriptionController.clear();
          });
        } else if (mounted) {
          setState(() {
            _responseMessage = 'Failed to post job. Please check backend logs.';
          });
        }
      } catch (e) {
        if (mounted) {
          setState(() {
            _responseMessage = 'Error: ${e.toString()}';
          });
        }
      } finally {
        if (mounted) {
          setState(() {
            _isLoading = false;
          });
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Post New Job',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 20),
            Form(
              key: _formKey,
              child: GlassCard(
                child: Material( // ADDED Material widget here
                  type: MaterialType.transparency, // Makes it transparent so GlassCard's background is visible
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      children: [
                        TextFormField(
                          controller: _titleController,
                          decoration: InputDecoration(
                            labelText: 'Job Title',
                            labelStyle: TextStyle(color: isDarkMode ? darkMutedTextColor : mutedTextColor),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          style: TextStyle(color: isDarkMode ? darkPrimaryTextColor : primaryTextColor),
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Please enter a job title';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _descriptionController,
                          maxLines: 5,
                          decoration: InputDecoration(
                            labelText: 'Job Description',
                            labelStyle: TextStyle(color: isDarkMode ? darkMutedTextColor : mutedTextColor),
                            alignLabelWithHint: true,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          style: TextStyle(color: isDarkMode ? darkPrimaryTextColor : primaryTextColor),
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Please enter a job description';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 16),
                        DropdownButtonFormField<String>(
                          value: _selectedJobType,
                          decoration: InputDecoration(
                            labelText: 'Job Type',
                            labelStyle: TextStyle(color: isDarkMode ? darkMutedTextColor : mutedTextColor),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          dropdownColor: isDarkMode ? darkBackgroundFrom : Colors.white,
                          style: TextStyle(color: isDarkMode ? darkPrimaryTextColor : primaryTextColor),
                          items: <String>['Full-time', 'Part-time', 'Contract', 'Internship']
                              .map<DropdownMenuItem<String>>((String value) {
                            return DropdownMenuItem<String>(
                              value: value,
                              child: Text(value),
                            );
                          }).toList(),
                          onChanged: (String? newValue) {
                            setState(() {
                              _selectedJobType = newValue!;
                            });
                          },
                        ),
                        if (_responseMessage != null)
                          Padding(
                            padding: const EdgeInsetsDirectional.only(top: 16.0),
                            child: Text(
                              _responseMessage!,
                              style: TextStyle(
                                color: _responseMessage!.contains('Successfully') ? Colors.green : Colors.red,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        const SizedBox(height: 24),
                        _isLoading
                            ? const CircularProgressIndicator()
                            : ElevatedButton(
                                onPressed: _postJob,
                                style: ElevatedButton.styleFrom(
                                  minimumSize: const Size(double.infinity, 50),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                                child: const Text('Post Job', style: TextStyle(fontSize: 18)),
                              ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}