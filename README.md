# ShrinkByte

## Lossless File Compression and Decompression using Huffman Coding

ShrinkByte is a lossless file compression and decompression system built using **Huffman Coding**. The project focuses on reducing file size while ensuring that the original data can be recovered exactly after decompression.

The project is developed as a practical implementation of **Data Structures in C** and **Object-Oriented Programming in C++**, connecting core academic concepts with a real-world application in data storage and transfer.

---

## 📌 Motivation

With the continuous growth of digital data, storing and transferring files efficiently has become an important requirement. Larger files consume more storage space and may require more time and bandwidth during transfer.

Many files contain repetitive data that can be represented more efficiently without removing any information.

This motivated us to develop **ShrinkByte**, a system that applies lossless compression using Huffman Coding. The project allows us to explore how fundamental Data Structures such as frequency tables, minimum heaps and binary trees can be combined to solve a practical problem.

The goal is not to replace mature compression software, but to understand and implement the underlying compression process from the fundamentals.

---

## 🎯 Problem Statement

Develop a software system that can efficiently compress files using lossless data compression and restore them to their original form without any loss of information.

The system should:

- Reduce the size of suitable input files.
- Preserve all original information.
- Decompress the compressed file correctly.
- Verify that the recovered file is identical to the original.
- Demonstrate the practical use of Data Structures and OOP concepts.

---

## 💡 Proposed Solution

ShrinkByte uses **Huffman Coding**, a variable-length prefix coding technique used for lossless data compression.

The basic idea is to assign:

- **Shorter codes** to frequently occurring bytes.
- **Longer codes** to less frequently occurring bytes.

This allows the same information to be represented using fewer bits when the input contains suitable frequency patterns.

The system consists of two major operations:

### Compression

Input File → Frequency Analysis → Minimum Heap → Huffman Tree → Code Generation → Encoding → Compressed File

### Decompression

Compressed File → Metadata → Huffman Tree → Decoding → Reconstructed Data → Original File

---

# ⚙️ Technical Approach

## 1. File Reading

The input file is read in **binary mode** so that the system processes the actual byte values instead of relying on text-specific interpretation.

This makes byte-level processing possible and helps maintain the lossless property.

---

## 2. Frequency Analysis

The file is scanned and the frequency of each byte is calculated.

For example:

```text
Byte        Frequency
'A'         15
'B'          7
'C'          3
'D'          1
