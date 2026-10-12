#ifndef HUFFMAN_NODE_H
#define HUFFMAN_NODE_H

// One node of the Huffman tree.
// Leaves hold a byte value; internal nodes hold the sum of their children's frequencies.
struct HuffmanNode
{
    unsigned char data;
    int frequency;
    HuffmanNode *left;
    HuffmanNode *right;
    unsigned int id; // tie-break key so equal frequencies always build the same tree

    HuffmanNode(unsigned char d, int freq)
        : data(d), frequency(freq), left(nullptr), right(nullptr), id(d) {}
};

#endif
