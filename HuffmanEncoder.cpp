#include "HuffmanEncoder.h"
#include <fstream>
#include <iostream>

HuffmanEncoder::HuffmanEncoder() : root(nullptr) {}

HuffmanEncoder::~HuffmanEncoder() {
    freeTree(root);
}

void HuffmanEncoder::freeTree(HuffmanNode* node) {
    if (!node) return;
    freeTree(node->left);
    freeTree(node->right);
    delete node;
}

void HuffmanEncoder::buildTree(const std::map<unsigned char, int>& frequencyMap) {
    if (root) {
        freeTree(root);
        root = nullptr;
    }
    huffmanCodes.clear();

    if (frequencyMap.empty()) return;

    std::priority_queue<HuffmanNode*, std::vector<HuffmanNode*>, CompareNode> minHeap;

    for (const auto& pair : frequencyMap) {
        minHeap.push(new HuffmanNode(pair.first, pair.second));
    }

    if (minHeap.size() == 1) {
        HuffmanNode* child = minHeap.top();
        minHeap.pop();
        root = new HuffmanNode(0, child->frequency);
        root->left = child;
        root->right = nullptr;
        return;
    }

    while (minHeap.size() > 1) {
        HuffmanNode* left = minHeap.top();
        minHeap.pop();

        HuffmanNode* right = minHeap.top();
        minHeap.pop();

        HuffmanNode* parent = new HuffmanNode(0, left->frequency + right->frequency);
        parent->left = left;
        parent->right = right;

        minHeap.push(parent);
    }

    root = minHeap.top();
    minHeap.pop();
}

void HuffmanEncoder::generateCodes(HuffmanNode* node, const std::string& currentCode) {
    if (!node) return;

    if (!node->left && !node->right) {
        huffmanCodes[node->data] = currentCode.empty() ? "0" : currentCode;
        return;
    }

    if (node->left) generateCodes(node->left, currentCode + "0");
    if (node->right) generateCodes(node->right, currentCode + "1");
}

void HuffmanEncoder::buildCodes() {
    huffmanCodes.clear();
    if (root) {
        generateCodes(root, "");
    }
}

std::string HuffmanEncoder::encodeStringToBits(const std::string& text) {
    std::string encodedBits = "";
    for (unsigned char ch : text) {
        encodedBits += huffmanCodes[ch];
    }
    return encodedBits;
}

bool HuffmanEncoder::compressFile(const std::string& inputFilePath, const std::string& outputFilePath) {
    std::ifstream in(inputFilePath, std::ios::binary);
    if (!in.is_open()) return false;

    std::map<unsigned char, int> freqMap;
    char buffer[4096];
    uint64_t originalSize = 0;

    while (in.read(buffer, sizeof(buffer)) || in.gcount() > 0) {
        std::streamsize bytesRead = in.gcount();
        originalSize += bytesRead;
        for (std::streamsize i = 0; i < bytesRead; ++i) {
            freqMap[static_cast<unsigned char>(buffer[i])]++;
        }
    }

    buildTree(freqMap);
    buildCodes();

    std::ofstream out(outputFilePath, std::ios::binary);
    if (!out.is_open()) return false;

    const char MAGIC[4] = {'S', 'B', '0', '1'};
    out.write(MAGIC, 4);
    out.write(reinterpret_cast<const char*>(&originalSize), sizeof(originalSize));

    uint16_t uniqueCount = static_cast<uint16_t>(freqMap.size());
    out.write(reinterpret_cast<const char*>(&uniqueCount), sizeof(uniqueCount));

    for (const auto& pair : freqMap) {
        uint8_t ch = pair.first;
        uint32_t freq = static_cast<uint32_t>(pair.second);
        out.write(reinterpret_cast<const char*>(&ch), sizeof(ch));
        out.write(reinterpret_cast<const char*>(&freq), sizeof(freq));
    }

    in.clear();
    in.seekg(0, std::ios::beg);

    uint8_t bitBuffer = 0;
    int bitCount = 0;

    while (in.read(buffer, sizeof(buffer)) || in.gcount() > 0) {
        std::streamsize bytesRead = in.gcount();
        for (std::streamsize i = 0; i < bytesRead; ++i) {
            const std::string& code = huffmanCodes[static_cast<unsigned char>(buffer[i])];
            for (char bit : code) {
                bitBuffer = (bitBuffer << 1) | (bit == '1' ? 1 : 0);
                bitCount++;
                if (bitCount == 8) {
                    out.put(static_cast<char>(bitBuffer));
                    bitBuffer = 0;
                    bitCount = 0;
                }
            }
        }
    }

    if (bitCount > 0) {
        bitBuffer <<= (8 - bitCount);
        out.put(static_cast<char>(bitBuffer));
    }

    in.close();
    out.close();
    return true;
}

const std::map<unsigned char, std::string>& HuffmanEncoder::getCodes() const {
    return huffmanCodes;
}

HuffmanNode* HuffmanEncoder::getRoot() const {
    return root;
}
