#ifndef HUFFMAN_NODE_H
#define HUFFMAN_NODE_H

struct HuffmanNode 
{
    unsigned char data;
    int frequency;

    HuffmanNode *left;
    HuffmanNode *right;

    HuffmanNode(unsigned char d,int freq)
    {
        data=d;
        frequency=freq;
        left = NULL;
        right = NULL;
    }
};

#endif