import sys

with open('src/routes/index.tsx', 'r') as f:
    content = f.read()

# Remove the duplicated closing tags
# The content currently ends with:
# }
#     </div>
#   );
# }
#     </div>
#   );
# }

# We look for the last occurrence of function Index() and take everything up to the first Index closing sequence.
index_start = content.rfind('function Index()')
if index_start == -1:
    print("Could not find function Index")
    sys.exit(1)

# Find the helper components at the end
feature_card_start = content.find('function FeatureCard', index_start)
if feature_card_start == -1:
    # If not found, maybe they were lost. We should recover them from git too.
    print("FeatureCard missing, need full recovery")
    sys.exit(2)

# The content between Index start and FeatureCard should end with one Index closing sequence.
index_content = content[index_start:feature_card_start]
closing_sequence = '    </div>\n  );\n}'
last_index = index_content.rfind(closing_sequence)

if last_index != -1:
    # Remove everything after the first closing sequence within the Index component block
    fixed_index_content = index_content[:last_index + len(closing_sequence)]
    new_content = content[:index_start] + fixed_index_content + "\n\n" + content[feature_card_start:]
    
    with open('src/routes/index.tsx', 'w') as f:
        f.write(new_content)
else:
    print("Could not find closing sequence")
    sys.exit(3)
