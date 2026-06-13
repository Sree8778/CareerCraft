import ast
import builtins

def check_undefined_names(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        tree = ast.parse(f.read())
        
    # Gather builtins
    defined_names = set(dir(builtins))
    
    globals_set = set(defined_names)
    
    # First pass: collect all globals
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for name in node.names:
                globals_set.add(name.asname or name.name.split('.')[0])
        elif isinstance(node, ast.ImportFrom):
            for name in node.names:
                globals_set.add(name.asname or name.name)
        elif isinstance(node, ast.FunctionDef):
            globals_set.add(node.name)
        elif isinstance(node, ast.ClassDef):
            globals_set.add(node.name)
            
    # Also collect assignments in the global scope (top level)
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    globals_set.add(target.id)
                elif isinstance(target, ast.Tuple) or isinstance(target, ast.List):
                    for el in target.elts:
                        if isinstance(el, ast.Name):
                            globals_set.add(el.id)
                            
    errors = []
    
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            # Define function scope
            local_names = set()
            # Add arguments
            for arg in node.args.args:
                local_names.add(arg.arg)
            if node.args.vararg:
                local_names.add(node.args.vararg.arg)
            if node.args.kwarg:
                local_names.add(node.args.kwarg.arg)
            for arg in node.args.kwonlyargs:
                local_names.add(arg.arg)
                
            # Collect local assignments and local imports
            for child in ast.walk(node):
                if isinstance(child, ast.Assign):
                    for target in child.targets:
                        if isinstance(target, ast.Name):
                            local_names.add(target.id)
                        elif isinstance(target, ast.Tuple) or isinstance(target, ast.List):
                            for el in target.elts:
                                if isinstance(el, ast.Name):
                                    local_names.add(el.id)
                elif isinstance(child, ast.Import):
                    for name in child.names:
                        local_names.add(name.asname or name.name.split('.')[0])
                elif isinstance(child, ast.ImportFrom):
                    for name in child.names:
                        local_names.add(name.asname or name.name)
                # Exception handlers store exceptions in a target name
                elif isinstance(child, ast.ExceptHandler):
                    if child.name:
                        local_names.add(child.name)
                        
            # Now verify all loaded names inside this function
            for child in ast.walk(node):
                if isinstance(child, ast.Name) and isinstance(child.ctx, ast.Load):
                    name_id = child.id
                    if name_id not in globals_set and name_id not in local_names:
                        # Skip special decorators or dynamic imports if nested inside other libraries
                        errors.append((node.name, name_id, child.lineno))
                        
    return errors

errors = check_undefined_names('routes.py')
if errors:
    for func_name, var_name, line in errors:
        print(f"In function '{func_name}' at line {line}: Undefined name '{var_name}'")
else:
    print("No undefined names found!")
