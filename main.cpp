#include "HuffmanEncoder.h"
#include <iostream>

int main() {
    HuffmanEncoder encoder;
    std::string sampleText = "BEEP BOOP BEER!";
    std::map<unsigned char, int> freqMap;
    for (unsigned char c : sampleText) 
    {
        freqMap[c]++;
    }
    encoder.buildTree(freqMap);
    encoder.buildCodes();
    std::cout << "SHRINK BYTE: HUFFMAN CODES\n";
    for (const auto& pair : encoder.getCodes()) 
    {
        std::cout << "'" << pair.first << "' : " << pair.second << "\n";
    }
    std::string encodedBits = encoder.encodeStringToBits(sampleText);
    std::cout << "\nOriginal Text : " << sampleText << " (" << sampleText.size() * 8 << " bits)\n";
    std::cout << "Encoded Bits  : " << encodedBits << " (" << encodedBits.size() << " bits)\n";
    std::cout << "Space Saved   : " 
              << (100.0 - (encodedBits.size() * 100.0 / (sampleText.size() * 8))) << "%\n";

    return 0;
}
