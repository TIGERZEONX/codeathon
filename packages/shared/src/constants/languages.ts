export interface SupportedLanguage {
  id: string; // e.g. 'python', 'javascript', 'cpp', 'c', 'java'
  name: string;
  judge0Id: number; // Standard Judge0 CE language id
  extension: string;
  defaultStarterCode: string;
}

export const SUPPORTED_LANGUAGES: Record<string, SupportedLanguage> = {
  python: {
    id: 'python',
    name: 'Python (3.10)',
    judge0Id: 71,
    extension: 'py',
    defaultStarterCode: `import sys

def solve():
    # Read input from standard input
    input_data = sys.stdin.read().split()
    if not input_data:
        return
    # Write your solution here
    print("Hello, Codeathon!")

if __name__ == '__main__':
    solve()
`,
  },
  javascript: {
    id: 'javascript',
    name: 'JavaScript (Node.js 20)',
    judge0Id: 63,
    extension: 'js',
    defaultStarterCode: `const fs = require('fs');

function solve() {
  const input = fs.readFileSync(0, 'utf-8').trim();
  if (!input) return;
  // Write your solution here
  console.log("Hello, Codeathon!");
}

solve();
`,
  },
  cpp: {
    id: 'cpp',
    name: 'C++ (GCC 9.2)',
    judge0Id: 54,
    extension: 'cpp',
    defaultStarterCode: `#include <iostream>
#include <vector>
#include <string>

using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    
    // Write your solution here
    cout << "Hello, Codeathon!\\n";
    return 0;
}
`,
  },
  c: {
    id: 'c',
    name: 'C (GCC 9.2)',
    judge0Id: 50,
    extension: 'c',
    defaultStarterCode: `#include <stdio.h>

int main() {
    // Write your solution here
    printf("Hello, Codeathon!\\n");
    return 0;
}
`,
  },
  java: {
    id: 'java',
    name: 'Java (OpenJDK 13/17)',
    judge0Id: 62,
    extension: 'java',
    defaultStarterCode: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        // Write your solution here
        System.out.println("Hello, Codeathon!");
    }
}
`,
  },
};

export const LANGUAGE_KEYS = Object.keys(SUPPORTED_LANGUAGES);
