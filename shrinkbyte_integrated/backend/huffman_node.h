#ifndef HUFFMAN_NODE_H
#define HUFFMAN_NODE_H

#include <cstdint>

// ONE shared definition of the tree node (used by minheap + encoder)
struct HuffmanNode {
    unsigned char data;
    uint64_t frequency;
    HuffmanNode *left;
    HuffmanNode *right;
    unsigned int id;

    HuffmanNode(unsigned char d, uint64_t freq)
        : data(d), frequency(freq), left(nullptr), right(nullptr), id(d) {}
};

// Defined in minheap.cpp
void freeTree(HuffmanNode* node);

#endif
