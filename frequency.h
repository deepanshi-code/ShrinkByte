#ifndef FREQUENCY_H
#define FREQUENCY_H

#include <string>

// Counts how often each byte value (0-255) appears in the file.
// Returns false if the file cannot be opened.
bool calculateFrequency(std::string filename, int frequency[256]);

// Prints every byte value that occurs at least once, with its count.
void displayFrequency(int frequency[256]);

#endif
