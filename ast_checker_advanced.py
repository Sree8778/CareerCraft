import ast
import builtins
import os

class ScopeVisitor(ast.NodeVisitor):
    def __init__(self):
        # Global names defined in the file
        self.globals = set(dir(builtins))
        # Errors found: list of (filename, funcname, varname, lineno)
        self.errors = []
        self.current_file = ""

    def check_file(self, filepath):
        self.current_file = filepath
        with open(filepath, 'r', encoding='utf-8') as f:
            try:
                tree = ast.parse(f.read())
            except SyntaxError as e:
                print(f"Syntax error in {filepath}: {e}")
                return
        
        # Reset globals for the file, including standard builtins
        self.globals = set(dir(builtins))
        self.globals.add("__file__")
        self.globals.add("__name__")
        
        # First pass: collect all top-level globals
        for node in tree.body:
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                for name in node.names:
                    self.globals.add(name.asname or name.name.split('.')[0])
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                self.globals.add(node.name)
            elif isinstance(node, ast.Assign):
                for target in node.targets:
                    self.extract_targets(target, self.globals)
            elif isinstance(node, (ast.AnnAssign, ast.AugAssign)):
                self.extract_targets(node.target, self.globals)
                
        # Second pass: check functions
        self.visit(tree)

    def extract_targets(self, node, target_set):
        """Extract name targets from assignments, loops, with statements etc."""
        if isinstance(node, ast.Name):
            target_set.add(node.id)
        elif isinstance(node, (ast.Tuple, ast.List)):
            for elt in node.elts:
                self.extract_targets(elt, target_set)
        elif isinstance(node, ast.Starred):
            self.extract_targets(node.value, target_set)

    def visit_FunctionDef(self, node):
        self.check_function_scope(node)

    def visit_AsyncFunctionDef(self, node):
        self.check_function_scope(node)

    def check_function_scope(self, func_node):
        # Local names defined inside the function
        locals_set = set()
        
        # 1. Add arguments
        for arg in func_node.args.args:
            locals_set.add(arg.arg)
        if func_node.args.vararg:
            locals_set.add(func_node.args.vararg.arg)
        if func_node.args.kwarg:
            locals_set.add(func_node.args.kwarg.arg)
        for arg in func_node.args.kwonlyargs:
            locals_set.add(arg.arg)
            
        # Helper to collect all defined local variables
        # Walk local scope to find variable bindings (Assignments, Loops, Imports, etc.)
        for child in ast.walk(func_node):
            if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                # Nested functions/classes define their own names in the parent scope
                if child is not func_node:
                    locals_set.add(child.name)
            elif isinstance(child, ast.Assign):
                for target in child.targets:
                    self.extract_targets(target, locals_set)
            elif isinstance(child, (ast.AnnAssign, ast.AugAssign)):
                self.extract_targets(child.target, locals_set)
            elif isinstance(child, ast.For):
                self.extract_targets(child.target, locals_set)
            elif isinstance(child, ast.AsyncFor):
                self.extract_targets(child.target, locals_set)
            elif isinstance(child, ast.With):
                for item in child.items:
                    if item.optional_vars:
                        self.extract_targets(item.optional_vars, locals_set)
            elif isinstance(child, ast.AsyncWith):
                for item in child.items:
                    if item.optional_vars:
                        self.extract_targets(item.optional_vars, locals_set)
            elif isinstance(child, ast.ExceptHandler):
                if child.name:
                    locals_set.add(child.name)
            elif isinstance(child, ast.Import):
                for name in child.names:
                    locals_set.add(name.asname or name.name.split('.')[0])
            elif isinstance(child, ast.ImportFrom):
                for name in child.names:
                    locals_set.add(name.asname or name.name)

        # We also need to identify names introduced inside generator expressions / comprehensions
        # because those variables are scoped to the comprehension expression.
        # We will do a separate traversal for loads, tracking comprehension scopes.
        self.check_loads(func_node, locals_set, func_node.name)

    def check_loads(self, func_node, outer_locals, func_name):
        # We will traverse the AST of the function to check Name loads.
        # If we encounter a comprehension, it creates a nested scope.
        
        # A simple stateful visitor for checks inside the function
        class LoadChecker(ast.NodeVisitor):
            def __init__(self, globals_set, locals_set, errors_list, filename, funcname):
                self.globals = globals_set
                self.scopes = [set(locals_set)] # stack of scopes
                self.errors = errors_list
                self.filename = filename
                self.funcname = funcname

            def visit_Name(self, node):
                if isinstance(node.ctx, ast.Load):
                    name_id = node.id
                    # Check if defined in any active scope
                    defined = False
                    for scope in reversed(self.scopes):
                        if name_id in scope:
                            defined = True
                            break
                    if not defined and name_id not in self.globals:
                        self.errors.append((self.filename, self.funcname, name_id, node.lineno))
                self.generic_visit(node)

            def check_comprehension(self, node, generators):
                # Comprehension variable targets are scoped to the comprehension itself
                comp_scope = set()
                for gen in generators:
                    # Target variables (e.g., `x` in `for x in ...`)
                    self.extract_comp_targets(gen.target, comp_scope)
                
                # Push comprehension scope
                self.scopes.append(comp_scope)
                # Visit generators (e.g. visiting gen.iter outside of target, gen.ifs)
                for gen in generators:
                    self.visit(gen.iter)
                    for if_node in gen.ifs:
                        self.visit(if_node)
                # Visit item/key/value inside the comprehension (which can load target variables)
                if hasattr(node, 'elt'):
                    self.visit(node.elt)
                elif hasattr(node, 'value'):
                    self.visit(node.value)
                    if hasattr(node, 'key'):
                        self.visit(node.key)
                # Pop comprehension scope
                self.scopes.pop()

            def extract_comp_targets(self, target_node, target_set):
                if isinstance(target_node, ast.Name):
                    target_set.add(target_node.id)
                elif isinstance(target_node, (ast.Tuple, ast.List)):
                    for elt in target_node.elts:
                        self.extract_comp_targets(elt, target_set)

            def visit_ListComp(self, node):
                self.check_comprehension(node, node.generators)

            def visit_SetComp(self, node):
                self.check_comprehension(node, node.generators)

            def visit_DictComp(self, node):
                self.check_comprehension(node, node.generators)

            def visit_GeneratorExp(self, node):
                self.check_comprehension(node, node.generators)

            def visit_Lambda(self, node):
                # Lambda arguments are scoped to the lambda body
                lambda_scope = set()
                for arg in node.args.args:
                    lambda_scope.add(arg.arg)
                self.scopes.append(lambda_scope)
                self.visit(node.body)
                self.scopes.pop()

            def visit_FunctionDef(self, node):
                # Do not recurse into nested function defs (they will be visited independently by outer ScopeVisitor)
                pass

            def visit_AsyncFunctionDef(self, node):
                # Do not recurse into nested function defs
                pass

            def visit_ClassDef(self, node):
                # Do not recurse into nested class defs
                pass

        checker = LoadChecker(self.globals, outer_locals, self.errors, self.current_file, func_name)
        # Visit function body statements
        for stmt in func_node.body:
            checker.visit(stmt)

visitor = ScopeVisitor()
backend_dirs = [
    r"c:\Users\sreer\Desktop\Job portal project\web\backend",
    r"c:\Users\sreer\Desktop\Job portal project\job-copilot\backend"
]

all_py_files = []
for d in backend_dirs:
    if os.path.exists(d):
        for root, dirs, files in os.walk(d):
            if ".venv" in root or "__pycache__" in root:
                continue
            for f in files:
                if f.endswith('.py'):
                    all_py_files.append(os.path.join(root, f))

print(f"Auditing {len(all_py_files)} files...")
for py_file in all_py_files:
    visitor.check_file(py_file)

if visitor.errors:
    print("\n--- UNDEFINED VARIABLES FOUND ---")
    for filename, func_name, var_name, line in visitor.errors:
        print(f"File: {os.path.basename(filename)} | Function: '{func_name}' | Line: {line} | Undefined Name: '{var_name}'")
else:
    print("\nNo undefined variables found! All files clean.")
