#ifndef HUFFMAN_ENCODER_H
#define HUFFMAN_ENCODER_H

#include "HuffmanNode.h"
#include <map>
#include <string>
#include <vector>
#include <queue>
struct CompareNode {
    bool operator()(const HuffmanNode* a, const HuffmanNode* b) const {
        return a->frequency > b->frequency;
    }
};

class HuffmanEncoder {
private:
    HuffmanNode* root;
    std::map<unsigned char, std::string> huffmanCodes;

    void generateCodes(HuffmanNode* node, const std::string& currentCode);
    void freeTree(HuffmanNode* node);

public:
    HuffmanEncoder();
    ~HuffmanEncoder();
    void buildTree(const std::map<unsigned char, int>& frequencyMap);
    void buildCodes();
    std::string encodeStringToBits(const std::string& text);
    bool compressFile(const std::string& inputFilePath, const std::string& outputFilePath);
    const std::map<unsigned char, std::string>& getCodes() const;
    HuffmanNode* getRoot() const;
};

#endif 
