# Huffman Coding: Theoretical Foundation & Construction

Huffman coding is a lossless data compression algorithm developed by David Huffman. Its core principle is **entropy encoding**: assigning variable-length codes to input characters, where shorter codes are assigned to more frequent characters and longer codes to less frequent ones.

---

## 1. Core Principles

* **Prefix Rule (Prefix Code):** No code is a prefix of any other code. For example, if `A` is `0`, no other character's code can start with `0` (e.g., `01` is invalid). This eliminates the need for delimiters between codes during decompression; the bitstream can be parsed unambiguously from left to right.
* **Greedy Approach:** It builds a binary tree from the bottom up by repeatedly merging the two nodes with the lowest frequencies.

---

## 2. Tree Construction Algorithm

The Huffman tree is constructed using a priority queue (min-heap) through the following steps:

1. **Frequency Analysis:** Count the occurrences of every unique byte in the input data.
2. **Create Leaf Nodes:** For each unique byte, create a leaf node containing its character/byte value and its frequency.
3. **Initialize Priority Queue:** Insert all leaf nodes into a min-heap ordered by frequency.
4. **Merge Nodes:** While there is more than one node in the heap:
   * Extract the two nodes with the lowest frequencies.
   * Create a new internal node whose frequency is the sum of the two extracted nodes' frequencies.
   * Make the two extracted nodes the left and right children of the new internal node.
   * Insert the new internal node back into the priority queue.
5. **Final Root:** The last remaining node in the heap becomes the root of the Huffman tree.

---

## 3. Deterministic Tie-Breaking

To ensure that the encoder and decoder generate the exact same tree topology—especially when multiple nodes share the same frequency—a strict tie-break rule is applied:

* **Primary Criterion:** Lower frequency is picked first.
* **Secondary Criterion (Tie-Breaker):** Smaller node identifier (`id`) is picked first.
  * *Leaf nodes* are assigned an `id` equal to their byte value ($0$ to $255$).
  * *Internal nodes* are assigned sequential `id` values starting from $256$ in the order they are created.

Because both the compression and decompression routines use this identical tie-break logic, the resulting tree is completely deterministic. This allows the system to reconstruct the tree purely from the lightweight frequency table stored in the file header, avoiding the need to serialize the tree's structure.
